from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.tours.models import Tour

from .models import Expense
from .serializers import ExpenseSerializer


def get_member_tour(user, tour_id):
    """Return the tour if the user is one of its members, else 404."""
    return get_object_or_404(
        Tour.objects.filter(members__user=user).distinct(), pk=tour_id
    )


class ExpenseListCreateAPIView(generics.ListCreateAPIView):
    """List and add expenses for a specific tour. Any tour member can do both."""

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_tour(self):
        return get_member_tour(self.request.user, self.kwargs["tour_id"])

    def get_queryset(self):
        tour = self.get_tour()
        return Expense.objects.filter(tour=tour).select_related("added_by")

    def perform_create(self, serializer):
        tour = self.get_tour()
        serializer.save(tour=tour, added_by=self.request.user)


class ExpenseDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Any tour member can view an expense, but only the member who
    originally added it may edit or delete it (FR-8 business rule).
    """

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        return Expense.objects.filter(tour__members__user=self.request.user).distinct()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            if obj.added_by_id != request.user.id:
                raise PermissionDenied(
                    "Only the member who added this expense can modify it."
                )
