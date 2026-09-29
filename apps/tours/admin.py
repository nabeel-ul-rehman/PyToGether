from django.contrib import admin

from .models import Tour, TourMember


class TourMemberInline(admin.TabularInline):
    model = TourMember
    extra = 0


@admin.register(Tour)
class TourAdmin(admin.ModelAdmin):
    list_display = ("title", "destination", "created_by", "status", "join_code", "budget", "start_date", "end_date")
    list_filter = ("status",)
    search_fields = ("title", "destination", "join_code")
    inlines = [TourMemberInline]


@admin.register(TourMember)
class TourMemberAdmin(admin.ModelAdmin):
    list_display = ("tour", "user", "role", "joined_at")
    list_filter = ("role",)
