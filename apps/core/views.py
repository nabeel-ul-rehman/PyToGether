from decimal import Decimal

from django.db.models import Sum
from django.http import JsonResponse
from django.views.generic import TemplateView

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expenses.models import Expense
from apps.tours.models import Tour, TourMember


def health_check(request):
    """Lightweight Railway health endpoint that does not depend on the database."""
    return JsonResponse({"status": "ok"})


class HomePageView(TemplateView):
    template_name = "core/home.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["features"] = [
            ("link-2", "One-link joining", "Share a single 6-character code and everyone hops into the tour instantly."),
            ("receipt", "Fast expense logging", "Add what you spent, on what, in a couple of taps — no spreadsheets."),
            ("pie-chart", "Automatic splitting", "Totals and each member's fair share are calculated the moment an expense is added."),
            ("shield-check", "Private by default", "Only people who join with your code can see or add to a tour."),
        ]
        return context


class DashboardStatsAPIView(APIView):
    """Aggregate numbers shown on the dashboard cards + recent activity feed."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        tours = Tour.objects.filter(members__user=user).distinct()
        total_tours = tours.count()

        total_members = (
            TourMember.objects.filter(tour__in=tours).values("user").distinct().count()
        )

        total_expense = (
            Expense.objects.filter(tour__in=tours).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        balance = Decimal("0")
        for tour in tours:
            member_count = tour.members.count() or 1
            share = Decimal(str(tour.total_expense)) / member_count
            paid = (
                Expense.objects.filter(tour=tour, added_by=user).aggregate(
                    total=Sum("amount")
                )["total"]
                or Decimal("0")
            )
            balance += paid - share

        def serialize_tour(tour):
            return {
                "id": tour.id,
                "title": tour.title,
                "destination": tour.destination,
                "start_date": tour.start_date.isoformat(),
                "end_date": tour.end_date.isoformat(),
                "join_code": tour.join_code,
            }

        created_tours = tours.filter(created_by=user).order_by("-created_at")
        joined_tours = tours.filter(members__user=user, members__role="member").order_by(
            "-created_at"
        )

        return Response(
            {
                "total_tours": total_tours,
                "total_members": total_members,
                "total_expense": total_expense,
                "balance": round(balance, 2),
                "created_tours": [serialize_tour(tour) for tour in created_tours],
                "joined_tours": [serialize_tour(tour) for tour in joined_tours],
            }
        )
