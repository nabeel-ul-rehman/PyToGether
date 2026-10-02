from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_raast_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="payment_methods",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
