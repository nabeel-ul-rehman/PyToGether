from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expenses.models import Expense
from apps.tours.models import Tour

from .models import Report, SettlementPayment
from .serializers import SettlementPaymentSerializer, TourReportSerializer


def _round(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class TourReportAPIView(APIView):
    """
    Computes the total spend and each member's paid amount, fair share,
    and balance for a tour, and upserts a Report snapshot row.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tour_id):
        tour = get_object_or_404(
            Tour.objects.filter(members__user=request.user).distinct(),
            pk=tour_id,
        )

        members = list(tour.members.select_related("user").all())
        member_count = len(members) or 1

        total_expense = tour.expenses.aggregate(total=Sum("amount"))["total"] or Decimal("0")
        per_member_share = _round(total_expense / member_count)

        paid_by_user = dict(
            Expense.objects.filter(tour=tour)
            .values_list("added_by_id")
            .annotate(total=Sum("amount"))
        )

        payments = list(
            SettlementPayment.objects.filter(tour=tour).select_related("payer", "recipient")
        )
        settlement_adjustments = defaultdict(lambda: Decimal("0"))
        for payment in payments:
            if payment.status == "approved":
                settlement_adjustments[payment.payer_id] += payment.amount
                settlement_adjustments[payment.recipient_id] -= payment.amount

        member_rows = []
        for member in members:
            paid = paid_by_user.get(member.user_id) or Decimal("0")
            member_rows.append(
                {
                    "user_id": member.user_id,
                    "full_name": member.user.full_name,
                    "email": member.user.email,
                    "raast_number": member.user.raast_number,
                    "payment_methods": member.user.payment_methods,
                    "role": member.role,
                    "paid": _round(paid),
                    "share": per_member_share,
                    "balance": _round(
                        paid - per_member_share + settlement_adjustments[member.user_id]
                    ),
                }
            )

        report, _ = Report.objects.update_or_create(
            tour=tour,
            defaults={
                "total_expense": total_expense,
                "per_member_share": per_member_share,
            },
        )

        data = {
            "tour_id": tour.id,
            "tour_title": tour.title,
            "budget": tour.budget,
            "total_expense": total_expense,
            "remaining_budget": tour.budget - total_expense,
            "member_count": len(members),
            "per_member_share": per_member_share,
            "generated_at": report.generated_at,
            "can_approve_payments": tour.created_by_id == request.user.id,
            "members": member_rows,
            "payments": [
                {
                    "id": payment.id,
                    "recipient": payment.recipient_id,
                    "recipient_name": payment.recipient.full_name,
                    "payer_name": payment.payer.full_name,
                    "amount": payment.amount,
                    "payment_method": payment.payment_method,
                    "payment_details": payment.payment_details,
                    "payment_method_display": payment.get_payment_method_display(),
                    "status": payment.status,
                    "status_display": payment.get_status_display(),
                    "note": payment.note,
                    "paid_at": payment.paid_at,
                }
                for payment in payments
            ],
        }

        serializer = TourReportSerializer(data)
        return Response(serializer.data)


class TourPaymentCreateAPIView(APIView):
    """Record a settlement payment made by the authenticated tour member."""

    permission_classes = [IsAuthenticated]

    def post(self, request, tour_id):
        tour = get_object_or_404(
            Tour.objects.filter(members__user=request.user).distinct(), pk=tour_id
        )
        serializer = SettlementPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        if amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})

        recipient_id = serializer.validated_data["recipient"]
        if recipient_id == request.user.id:
            raise ValidationError({"recipient": "Choose another tour member."})
        if not tour.members.filter(user_id=recipient_id).exists():
            raise ValidationError({"recipient": "Recipient must belong to this tour."})

        payment = SettlementPayment.objects.create(
            tour=tour,
            payer=request.user,
            recipient_id=recipient_id,
            amount=amount,
            payment_method=serializer.validated_data["payment_method"],
            payment_details=serializer.validated_data.get("payment_details", {}),
            note=serializer.validated_data.get("note", ""),
        )
        return Response(
            SettlementPaymentSerializer(
                {
                    "id": payment.id,
                    "recipient": payment.recipient_id,
                    "recipient_name": payment.recipient.full_name,
                    "payer_name": payment.payer.full_name,
                    "amount": payment.amount,
                    "payment_method": payment.payment_method,
                    "payment_details": payment.payment_details,
                    "payment_method_display": payment.get_payment_method_display(),
                    "status": payment.status,
                    "status_display": payment.get_status_display(),
                    "note": payment.note,
                    "paid_at": payment.paid_at,
                }
            ).data,
            status=status.HTTP_201_CREATED,
        )


class TourPaymentApprovalAPIView(APIView):
    """Only the payment recipient may approve or reject a pending settlement payment."""

    permission_classes = [IsAuthenticated]

    def post(self, request, tour_id, payment_id):
        payment = get_object_or_404(
            SettlementPayment,
            pk=payment_id,
            tour_id=tour_id,
            recipient=request.user,
        )
        action = request.data.get("action")

        if action not in ("approved", "rejected"):
            raise ValidationError({"action": "Choose approved or rejected."})
        if payment.status != "pending":
            raise ValidationError({"detail": "This payment has already been reviewed."})

        payment.status = action
        payment.save(update_fields=["status"])
        return Response({"success": True, "status": payment.status})


class PaymentNotificationListAPIView(APIView):
    """List pending payments received by the current user for approval."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = (
            SettlementPayment.objects.filter(
                status="pending",
                recipient=request.user,
            )
            .select_related("tour", "payer", "recipient")
            .order_by("-paid_at")
        )

        return Response(
            {
                "count": payments.count(),
                "notifications": [
                    {
                        "id": payment.id,
                        "tour_id": payment.tour_id,
                        "tour_title": payment.tour.title,
                        "payer_name": payment.payer.full_name,
                        "recipient_name": payment.recipient.full_name,
                        "amount": payment.amount,
                        "payment_method": payment.get_payment_method_display(),
                        "paid_at": payment.paid_at,
                        "can_review": True,
                        "received": True,
                    }
                    for payment in payments
                ],
            }
        )
