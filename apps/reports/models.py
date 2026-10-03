from django.conf import settings
from django.db import models

from apps.tours.models import Tour


class Report(models.Model):
    """
    A cached snapshot of a tour's final expense summary.
    Recomputed and upserted whenever the report is viewed, so it always
    reflects the latest expenses while still giving the project a
    persisted 'reports' table as described in the SDS data design.
    """

    tour = models.OneToOneField(Tour, on_delete=models.CASCADE, related_name="report")
    total_expense = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    per_member_share = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Report"
        verbose_name_plural = "Reports"

    def __str__(self):
        return f"Report for {self.tour}"


class SettlementPayment(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("bank_transfer", "Bank Transfer"),
        ("jazzcash", "JazzCash"),
        ("easypaisa", "Easypaisa"),
        ("raast", "Raast (manual transfer)"),
        ("other", "Other"),
        ("stripe_card", "Card (Stripe)"),
    ]

    tour = models.ForeignKey(
        Tour, on_delete=models.CASCADE, related_name="settlement_payments"
    )
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments_made"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments_received"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_details = models.JSONField(default=dict, blank=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, unique=True, null=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    note = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at"]
        verbose_name = "Settlement Payment"
        verbose_name_plural = "Settlement Payments"

    def __str__(self):
        return f"{self.payer} paid {self.recipient} {self.amount}"
