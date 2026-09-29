from rest_framework import serializers


class MemberShareSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.CharField()
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
        choices=["cash", "bank_transfer", "jazzcash", "easypaisa", "other"]
    )
    payment_method_display = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.CharField(read_only=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
    paid_at = serializers.DateTimeField(read_only=True)


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
