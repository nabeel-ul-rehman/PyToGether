from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0004_alter_settlementpayment_payment_method"),
    ]

    operations = [
        migrations.AddField(
            model_name="settlementpayment",
            name="payment_details",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
