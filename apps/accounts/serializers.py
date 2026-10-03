from rest_framework import serializers
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from .models import PAYMENT_METHOD_CHOICES, User


def validate_payment_method_entries(entries):
    allowed_methods = {choice[0] for choice in PAYMENT_METHOD_CHOICES}
    legacy_methods = {"bank_transfer", "jazzcash", "easypaisa"}
    normalized_entries = []
    seen_entries = set()
    for index, payment_method in enumerate(entries):
        method = payment_method.get("method")
        identifier = payment_method.get("identifier", "").strip()
        if method in legacy_methods:
            method = "raast"
        if method not in allowed_methods:
            raise serializers.ValidationError({index: "Choose a valid payment method."})
        if method != "cash" and not identifier:
            raise serializers.ValidationError({index: "Enter the account number or ID for this method."})
        entry_key = (method, identifier)
        if entry_key not in seen_entries:
            normalized_entries.append({"method": method, "identifier": identifier})
            seen_entries.add(entry_key)
    return normalized_entries


class RegisterSerializer(serializers.ModelSerializer):

    confirm_password = serializers.CharField(write_only=True)
    payment_methods = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    class Meta:
        model = User

        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "raast_number",
            "payment_methods",
            "password",
            "confirm_password",
        ]

        extra_kwargs = {
            "password": {
                "write_only": True
            }
        }

    def validate_email(self, value):

        if User.objects.filter(email=value).exists():

            raise serializers.ValidationError(
                "Email already exists."
            )

        return value

    def validate(self, attrs):
        attrs["payment_methods"] = validate_payment_method_entries(attrs.get("payment_methods", []))

        if attrs["password"] != attrs["confirm_password"]:

            raise serializers.ValidationError(
                {
                    "confirm_password":
                    "Passwords do not match."
                }
            )

        return attrs

    def create(self, validated_data):

        validated_data.pop("confirm_password")

        password = validated_data.pop("password")

        user = User(**validated_data)

        user.set_password(password)

        user.save()

        return user

class LoginSerializer(serializers.Serializer):
    
    email = serializers.EmailField()

    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError(
                "Invalid email or password."
            )
        if not user.is_active:
            raise serializers.ValidationError(
                "User account is inactive."
            )
        attrs["user"] = user
        return attrs

class ProfileSerializer(serializers.ModelSerializer):
    payment_methods = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "raast_number",
            "payment_methods",
            "profile_image",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payment_methods"] = validate_payment_method_entries(data.get("payment_methods", []))
        return data

    def validate_payment_methods(self, value):
        return validate_payment_method_entries(value)

    def validate_email(self, value):
        query = User.objects.filter(email=value)

        if self.instance:
            query = query.exclude(pk=self.instance.pk)

        if query.exists():
            raise serializers.ValidationError("Email already exists.")

        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError({"confirm_new_password": "New passwords do not match."})

        try:
            validate_password(attrs["new_password"], self.context["request"].user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"new_password": error.messages}) from error
        return attrs
