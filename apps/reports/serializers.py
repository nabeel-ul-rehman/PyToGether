from rest_framework import serializers


class MemberShareSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.CharField()
    raast_number = serializers.CharField(allow_blank=True)
    payment_methods = serializers.ListField(child=serializers.DictField())
    role = serializers.CharField()
    paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    share = serializers.DecimalField(max_digits=10, decimal_places=2)
    balance = serializers.DecimalField(max_digits=10, decimal_places=2)


class SettlementPaymentSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    recipient = serializers.IntegerField()
    recipient_name = serializers.CharField(read_only=True)
    payer_name = serializers.CharField(read_only=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(
        choices=["cash", "raast", "other", "stripe_card"]
    )
    payment_details = serializers.JSONField(required=False, default=dict)
    payment_method_display = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.CharField(read_only=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
    paid_at = serializers.DateTimeField(read_only=True)

    def validate(self, attrs):
        method = attrs.get("payment_method")
        details = attrs.get("payment_details", {})
        if method == "raast":
            if not details.get("sender_account"):
                raise serializers.ValidationError({"payment_details": {"sender_account": "Enter the Raast number you paid from."}})
            if not details.get("transaction_reference"):
                raise serializers.ValidationError({"payment_details": {"transaction_reference": "Enter the Raast transaction reference."}})
        return attrs


class TourReportSerializer(serializers.Serializer):
    tour_id = serializers.IntegerField()
    tour_title = serializers.CharField()
    budget = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=10, decimal_places=2)
    remaining_budget = serializers.DecimalField(max_digits=10, decimal_places=2)
    member_count = serializers.IntegerField()
    per_member_share = serializers.DecimalField(max_digits=10, decimal_places=2)
    generated_at = serializers.DateTimeField()
    members = MemberShareSerializer(many=True)
    payments = SettlementPaymentSerializer(many=True)
    can_approve_payments = serializers.BooleanField()
