import random
import string

from django.conf import settings
from django.db import models


def generate_join_code():
    """Generate a short, human-friendly, unique join code e.g. 7F3K9A."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(alphabet, k=6))
        if not Tour.objects.filter(join_code=code).exists():
            return code


class Tour(models.Model):
    STATUS_CHOICES = [
        ("planned", "Planned"),
        ("ongoing", "Ongoing"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tours"
    )
    title = models.CharField(max_length=150)
    destination = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="tours/", blank=True, null=True)
    budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned")

    join_code = models.CharField(max_length=10, unique=True, editable=False, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Tour"
        verbose_name_plural = "Tours"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.join_code:
            self.join_code = generate_join_code()
        super().save(*args, **kwargs)

    @property
    def member_count(self):
        return self.members.count()

    @property
    def total_expense(self):
        total = self.expenses.aggregate(total=models.Sum("amount"))["total"]
        return total or 0


class TourMember(models.Model):
    ROLE_CHOICES = [
        ("creator", "Creator"),
        ("member", "Member"),
    ]

    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tour_memberships"
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["joined_at"]
        unique_together = ("tour", "user")
        verbose_name = "Tour Member"
        verbose_name_plural = "Tour Members"

    def __str__(self):
        return f"{self.user} in {self.tour}"
