from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0005_settlementpayment_payment_details"),
    ]

    operations = [
        migrations.AlterField(
            model_name="settlementpayment",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("cash", "Cash"),
                    ("bank_transfer", "Bank Transfer"),
                    ("jazzcash", "JazzCash"),
                    ("easypaisa", "Easypaisa"),
                    ("raast", "Raast (manual transfer)"),
                    ("other", "Other"),
                    ("stripe_card", "Card (Stripe)"),
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="settlementpayment",
            name="stripe_checkout_session_id",
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="settlementpayment",
            name="stripe_payment_intent_id",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
