from django.db.models import Q
from django.shortcuts import render
from django.views.generic import TemplateView

from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Tour, TourMember
from .pagination import TourPagination
from .permissions import IsTourMemberOrOwner
from .serializers import JoinTourSerializer, TourMemberSerializer, TourSerializer


# ---------------------------------------------------------------------------
# Page views (server-rendered shells; data is loaded client-side via the API)
# ---------------------------------------------------------------------------

class TourListPageView(TemplateView):
    template_name = "tours/tour-list.html"


class CreateTourPageView(TemplateView):
    template_name = "tours/create-tour.html"


class JoinTourPageView(TemplateView):
    template_name = "tours/join-tour.html"


def tour_detail_page(request, tour_id):
    return render(request, "tours/tour-detail.html", {"tour_id": tour_id})


def edit_tour_page(request, tour_id):
    return render(request, "tours/edit-tour.html", {"tour_id": tour_id})


# ---------------------------------------------------------------------------
# API views
# ---------------------------------------------------------------------------

class TourListAPIView(generics.ListAPIView):
    """Every tour the current user belongs to - as creator or joined member."""

    serializer_class = TourSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = TourPagination

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["title", "destination", "status"]
    ordering_fields = ["created_at", "budget", "start_date"]
    ordering = ["-created_at"]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        return (
            Tour.objects.filter(members__user=self.request.user)
            .distinct()
            .order_by("-created_at")
        )


class CreateTourAPIView(generics.CreateAPIView):
    serializer_class = TourSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        tour = serializer.save(created_by=self.request.user)
        TourMember.objects.create(tour=tour, user=self.request.user, role="creator")


class TourDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TourSerializer
    permission_classes = [IsAuthenticated, IsTourMemberOrOwner]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        return Tour.objects.filter(members__user=self.request.user).distinct()


class TourMembersAPIView(generics.ListAPIView):
    """List all members of a tour the current user belongs to."""

    serializer_class = TourMemberSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tour = generics.get_object_or_404(
            Tour.objects.filter(members__user=self.request.user).distinct(),
            pk=self.kwargs["pk"],
        )
        return tour.members.select_related("user").all()


class JoinTourAPIView(APIView):
    """Join an existing tour using its unique join code."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = JoinTourSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tour = serializer.tour

        if TourMember.objects.filter(tour=tour, user=request.user).exists():
            raise ValidationError({"join_code": "You have already joined this tour."})

        TourMember.objects.create(tour=tour, user=request.user, role="member")

        return Response(
            {
                "success": True,
                "message": f'Joined "{tour.title}" successfully.',
                "tour": TourSerializer(tour, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LeaveTourAPIView(APIView):
    """Leave a tour. The creator cannot leave their own tour (delete it instead)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            tour = Tour.objects.get(pk=pk, members__user=request.user)
        except Tour.DoesNotExist:
            return Response(
                {"detail": "Tour not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if tour.created_by_id == request.user.id:
            raise ValidationError(
                "The tour creator cannot leave. Delete the tour instead."
            )

        TourMember.objects.filter(tour=tour, user=request.user).delete()

        return Response(
            {"success": True, "message": f'You left "{tour.title}".'},
            status=status.HTTP_200_OK,
        )
