from django.urls import path

from .views import (
    DashboardPageView,
    ChangePasswordApiView,
    LoginAPIView,
    LoginPageView,
    ProfileApiView,
    ProfilePageView,
    RegisterAPIView,
    RegisterPageView,
)

app_name = "accounts"

urlpatterns = [
    path("login/", LoginPageView.as_view(), name="login-page"),
    path("register/", RegisterPageView.as_view(), name="register-page"),
    path("dashboard/", DashboardPageView.as_view(), name="dashboard"),
    path("profile/", ProfilePageView.as_view(), name="profile-page"),

    path("api/register/", RegisterAPIView.as_view(), name="register"),
    path("api/login/", LoginAPIView.as_view(), name="login-api"),
    path("api/profile/", ProfileApiView.as_view(), name="profile-api"),
    path("api/profile/change-password/", ChangePasswordApiView.as_view(), name="change-password-api"),
]
