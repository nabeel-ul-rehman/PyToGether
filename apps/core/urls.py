from django.urls import path

from .views import DashboardStatsAPIView, HomePageView, health_check

app_name = "core"

urlpatterns = [
    path("", HomePageView.as_view(), name="home"),
    path("health/", health_check, name="health"),
    path("api/dashboard-stats/", DashboardStatsAPIView.as_view(), name="dashboard-stats"),
]
