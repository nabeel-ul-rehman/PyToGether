from rest_framework import serializers

from .models import Tour, TourMember


class RelativeMediaImageField(serializers.ImageField):
    """Return media URLs that work on the same host as the web application."""

    def to_representation(self, value):
        if not value:
            return None
        return value.url


class TourMemberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = TourMember
        fields = ["id", "user", "full_name", "email", "role", "joined_at"]
        read_only_fields = fields


class TourSerializer(serializers.ModelSerializer):
    image = RelativeMediaImageField(required=False, allow_null=True)
    member_count = serializers.IntegerField(read_only=True)
    total_expense = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True
    )
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Tour
        fields = [
            "id",
            "title",
            "destination",
            "description",
            "image",
            "budget",
            "start_date",
            "end_date",
            "status",
            "join_code",
            "member_count",
            "total_expense",
            "created_by",
            "created_by_name",
            "is_owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "join_code",
            "created_at",
            "updated_at",
        ]

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and obj.created_by_id == request.user.id)

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be earlier than start date."}
            )

        budget = attrs.get("budget", getattr(self.instance, "budget", None))
        if budget is not None and budget < 0:
            raise serializers.ValidationError(
                {"budget": "Budget cannot be negative."}
            )

        return attrs


class JoinTourSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=10)

    def validate_join_code(self, value):
        value = value.strip().upper()
        try:
            tour = Tour.objects.get(join_code=value)
        except Tour.DoesNotExist:
            raise serializers.ValidationError("Invalid join code.")

        self.tour = tour
        return value
