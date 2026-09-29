from django.contrib import admin

from .models import Report, SettlementPayment


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("tour", "total_expense", "per_member_share", "generated_at")


@admin.register(SettlementPayment)
class SettlementPaymentAdmin(admin.ModelAdmin):
    list_display = ("tour", "payer", "recipient", "amount", "payment_method", "paid_at")
    list_filter = ("payment_method",)
