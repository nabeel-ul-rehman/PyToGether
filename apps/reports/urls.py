from django.urls import path

from .views import (
    PaymentNotificationListAPIView,
    TourPaymentApprovalAPIView,
    TourPaymentCreateAPIView,
    TourReportAPIView,
)

app_name = "reports"

urlpatterns = [
    path(
        "api/payment-notifications/",
        PaymentNotificationListAPIView.as_view(),
        name="payment-notifications",
    ),
    path(
        "api/tours/<int:tour_id>/report/",
        TourReportAPIView.as_view(),
        name="tour-report",
    ),
    path(
        "api/tours/<int:tour_id>/payments/",
        TourPaymentCreateAPIView.as_view(),
        name="tour-payment-create",
    ),
    path(
        "api/tours/<int:tour_id>/payments/<int:payment_id>/review/",
        TourPaymentApprovalAPIView.as_view(),
        name="tour-payment-review",
    ),
]
