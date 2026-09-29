from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("tour", "added_by", "category", "amount", "added_at")
    list_filter = ("category",)
    search_fields = ("description", "tour__title")
