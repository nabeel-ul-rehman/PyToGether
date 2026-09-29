from django.conf import settings
from django.db import models

from apps.tours.models import Tour


class Expense(models.Model):
    CATEGORY_CHOICES = [
        ("food", "Food"),
        ("travel", "Travel"),
        ("hotel", "Hotel"),
        ("other", "Other"),
    ]

    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name="expenses")
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expenses"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    description = models.CharField(max_length=255, blank=True)
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-added_at"]
        verbose_name = "Expense"
        verbose_name_plural = "Expenses"

    def __str__(self):
        return f"{self.description or self.category} - {self.amount}"
