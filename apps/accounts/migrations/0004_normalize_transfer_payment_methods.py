from django.db import migrations


LEGACY_METHODS = {"bank_transfer", "jazzcash", "easypaisa"}


def combine_transfer_methods(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.all().only("id", "payment_methods").iterator():
        methods = []
        seen = set()
        for entry in user.payment_methods or []:
            if not isinstance(entry, dict):
                continue
            method = "raast" if entry.get("method") in LEGACY_METHODS else entry.get("method")
            identifier = entry.get("identifier", "") or ""
            entry_key = (method, identifier)
            if entry_key in seen:
                continue
            methods.append({"method": method, "identifier": identifier})
            seen.add(entry_key)
        if methods != (user.payment_methods or []):
            User.objects.filter(pk=user.pk).update(payment_methods=methods)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_user_accepted_payment_methods"),
    ]

    operations = [
        migrations.RunPython(combine_transfer_methods, migrations.RunPython.noop),
    ]
