from django.db import migrations, models


def combine_transfer_methods(apps, schema_editor):
    Payment = apps.get_model("reports", "SettlementPayment")
    Payment.objects.filter(payment_method__in=["bank_transfer", "jazzcash", "easypaisa"]).update(
        payment_method="raast"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0006_settlementpayment_stripe_fields"),
    ]

    operations = [
        migrations.RunPython(combine_transfer_methods, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="settlementpayment",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("cash", "Cash"),
                    ("raast", "Raast / Bank / JazzCash / Easypaisa"),
                    ("other", "Other"),
                    ("stripe_card", "Card (Stripe)"),
                ],
                max_length=20,
            ),
        ),
    ]
