from rest_framework import serializers

from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source="added_by.full_name", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id",
            "tour",
            "amount",
            "category",
            "category_display",
            "description",
            "added_by",
            "added_by_name",
            "is_owner",
            "added_at",
            "updated_at",
        ]
        read_only_fields = ["id", "tour", "added_by", "added_at", "updated_at"]

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and obj.added_by_id == request.user.id)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
