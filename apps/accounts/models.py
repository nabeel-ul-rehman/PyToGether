from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser, PermissionsMixin
)
from .managers import UserManager


PAYMENT_METHOD_CHOICES = [
    ("cash", "Cash"),
    ("bank_transfer", "Bank Transfer"),
    ("jazzcash", "JazzCash"),
    ("easypaisa", "EasyPaisa"),
    ("raast", "Raast"),
]
# Create your models here.



class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(
        unique=True
    )

    full_name = models.CharField(
        max_length=150
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    raast_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="Raast ID or mobile number used to receive payments.",
    )

    payment_methods = models.JSONField(default=list, blank=True)

    profile_image = models.ImageField(
        upload_to="profiles/",
        blank=True,
        null=True
    )

    is_active = models.BooleanField(
        default=True
    )

    is_staff = models.BooleanField(
        default=False
    )

    date_joined = models.DateTimeField(
        auto_now_add=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    objects = UserManager()

    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = ["full_name"]


    class Meta:
        db_table = "users"
        ordering = ["-created_at"]

    def __str__(self):
        return self.email
