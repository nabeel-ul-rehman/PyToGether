from django.urls import path

from .views import (
    CreateTourAPIView,
    CreateTourPageView,
    JoinTourAPIView,
    JoinTourPageView,
    LeaveTourAPIView,
    TourDetailAPIView,
    TourListAPIView,
    TourListPageView,
    TourMembersAPIView,
    edit_tour_page,
    tour_detail_page,
)

app_name = "tours"

urlpatterns = [
    # ---- Pages ----
    path("tours/", TourListPageView.as_view(), name="tour-list-page"),
    path("tours/create/", CreateTourPageView.as_view(), name="create-tour-page"),
    path("tours/join/", JoinTourPageView.as_view(), name="join-tour-page"),
    path("tours/edit/<int:tour_id>/", edit_tour_page, name="edit-tour-page"),
    path("tours/<int:tour_id>/", tour_detail_page, name="tour-detail-page"),
    # ---- API ----
    path("api/tours/", TourListAPIView.as_view(), name="list-tours"),
    path("api/tours/create/", CreateTourAPIView.as_view(), name="create-tour"),
    path("api/tours/join/", JoinTourAPIView.as_view(), name="join-tour"),
    path("api/tours/<int:pk>/", TourDetailAPIView.as_view(), name="tour-detail-api"),
    path("api/tours/<int:pk>/members/", TourMembersAPIView.as_view(), name="tour-members"),
    path("api/tours/<int:pk>/leave/", LeaveTourAPIView.as_view(), name="leave-tour"),
]
