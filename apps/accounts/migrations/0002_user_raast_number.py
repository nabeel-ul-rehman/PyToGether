from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="raast_number",
            field=models.CharField(
                blank=True,
                help_text="Raast ID or mobile number used to receive payments.",
                max_length=100,
            ),
        ),
    ]
