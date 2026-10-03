from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import logging

import stripe
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from django.db.models import Sum
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from django.db.models import Q

from apps.expenses.models import Expense
from apps.tours.models import Tour

from .models import Report, SettlementPayment
from .serializers import SettlementPaymentSerializer, TourReportSerializer

logger = logging.getLogger(__name__)


def _stripe_ready():
    return bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_WEBHOOK_SECRET)


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
        if serializer.validated_data["payment_method"] == "stripe_card":
            raise ValidationError({"payment_method": "Use the Stripe Checkout endpoint for card payments."})

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


class TourStripeCheckoutAPIView(APIView):
    """Create a hosted Stripe Checkout session for a tour settlement."""

    permission_classes = [IsAuthenticated]

    def post(self, request, tour_id):
        if not _stripe_ready():
            return Response({"detail": "Stripe card payments are not configured."}, status=503)
        tour = get_object_or_404(Tour.objects.filter(members__user=request.user), pk=tour_id)
        serializer = SettlementPaymentSerializer(data={**request.data, "payment_method": "stripe_card"})
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        recipient_id = serializer.validated_data["recipient"]
        if amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})
        if recipient_id == request.user.id or not tour.members.filter(user_id=recipient_id).exists():
            raise ValidationError({"recipient": "Choose another member of this tour."})
        recipient = tour.members.select_related("user").get(user_id=recipient_id).user
        member_count = tour.members.count() or 1
        total_expense = tour.expenses.aggregate(total=Sum("amount"))["total"] or Decimal("0")
        share = _round(total_expense / member_count)
        paid = dict(Expense.objects.filter(tour=tour).values_list("added_by_id").annotate(total=Sum("amount")))
        adjustments = defaultdict(lambda: Decimal("0"))
        for approved in SettlementPayment.objects.filter(tour=tour, status="approved"):
            adjustments[approved.payer_id] += approved.amount
            adjustments[approved.recipient_id] -= approved.amount
        payer_balance = _round((paid.get(request.user.id) or Decimal("0")) - share + adjustments[request.user.id])
        recipient_balance = _round((paid.get(recipient_id) or Decimal("0")) - share + adjustments[recipient_id])
        max_payable = min(-payer_balance, recipient_balance)
        if max_payable <= 0 or amount > max_payable:
            raise ValidationError({"amount": "Amount cannot exceed the balance owed to this member."})
        payment = SettlementPayment.objects.create(
            tour=tour, payer=request.user, recipient=recipient, amount=amount,
            payment_method="stripe_card", note=serializer.validated_data.get("note", ""),
        )
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                payment_method_types=["card"],
                line_items=[{"quantity": 1, "price_data": {
                    "currency": "pkr",
                    "unit_amount": int(amount * 100),
                    "product_data": {"name": f"PayTogether settlement to {recipient.full_name}"},
                }}],
                client_reference_id=str(payment.pk),
                metadata={"settlement_payment_id": str(payment.pk), "tour_id": str(tour.pk)},
                payment_intent_data={"metadata": {"settlement_payment_id": str(payment.pk)}},
                success_url=request.build_absolute_uri(f"/tours/{tour.pk}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}"),
                cancel_url=request.build_absolute_uri(f"/tours/{tour.pk}/?payment=cancelled"),
            )
        except stripe.StripeError:
            payment.delete()
            logger.exception("Unable to create Stripe Checkout session")
            return Response({"detail": "Unable to start card payment. Please try again."}, status=502)
        payment.stripe_checkout_session_id = session.id
        payment.save(update_fields=["stripe_checkout_session_id"])
        return Response({"checkout_url": session.url})


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def stripe_webhook(request):
    """Apply Stripe's signed payment result; browser redirects never mark a payment paid."""
    if not _stripe_ready():
        return HttpResponse(status=503)
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(request.body, signature, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError):
        return HttpResponse(status=400)

    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        session = event["data"]["object"]
        if session.get("payment_status") == "paid":
            with transaction.atomic():
                payment = SettlementPayment.objects.select_for_update().filter(
                    Q(stripe_checkout_session_id=session.get("id"))
                    | Q(pk=session.get("metadata", {}).get("settlement_payment_id")),
                    payment_method="stripe_card",
                ).first()
                expected_total = int(payment.amount * 100) if payment else None
                valid_session = (
                    payment
                    and session.get("currency") == "pkr"
                    and session.get("amount_total") == expected_total
                    and session.get("id")
                )
                if valid_session and payment.status == "pending":
                    payment.stripe_checkout_session_id = session.get("id") or payment.stripe_checkout_session_id
                    payment.stripe_payment_intent_id = session.get("payment_intent") or ""
                    payment.payment_details = {
                        "provider": "stripe",
                        "checkout_session": session.get("id"),
                        "card_payment_received": True,
                    }
                    payment.save(update_fields=["stripe_checkout_session_id", "stripe_payment_intent_id", "payment_details"])
    elif event["type"] in ("checkout.session.async_payment_failed", "checkout.session.expired"):
        session = event["data"]["object"]
        SettlementPayment.objects.filter(
            Q(stripe_checkout_session_id=session.get("id"))
            | Q(pk=session.get("metadata", {}).get("settlement_payment_id")),
            status="pending",
        ).update(status="rejected")
    return HttpResponse(status=200)


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
