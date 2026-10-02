from django.views.generic import TemplateView

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    ProfileSerializer,
    RegisterSerializer,
)
from .models import PAYMENT_METHOD_CHOICES


# ---------------------------------------------------------------------------
# Page views
# ---------------------------------------------------------------------------

class RegisterPageView(TemplateView):
    template_name = "auth/register.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["payment_method_choices"] = PAYMENT_METHOD_CHOICES
        return context


class LoginPageView(TemplateView):
    template_name = "auth/login.html"


class DashboardPageView(TemplateView):
    template_name = "dashboard/dashboard.html"


class ProfilePageView(TemplateView):
    template_name = "auth/profile.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["payment_method_choices"] = PAYMENT_METHOD_CHOICES
        return context


# ---------------------------------------------------------------------------
# API views
# ---------------------------------------------------------------------------

class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()

            return Response(
                {
                    "success": True,
                    "message": "Registration successful.",
                    "user": {
                        "id": user.id,
                        "full_name": user.full_name,
                        "email": user.email,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "success": True,
                    "message": "Login successful.",
                    "user": {
                        "id": user.id,
                        "full_name": user.full_name,
                        "email": user.email,
                    },
                    "tokens": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                    },
                }
            )

        # NOTE: the original implementation had no return here, which meant
        # a wrong-password attempt returned an empty 200 response instead of
        # a proper error. Fixed to always return a Response.
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileApiView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = ProfileSerializer(
            request.user, data=request.data, partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "success": True,
                    "message": "Profile updated successfully.",
                    "user": serializer.data,
                }
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordApiView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"success": True, "message": "Password changed successfully."})
