from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="stall",
            name="bank_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="stall",
            name="account_last4",
            field=models.CharField(blank=True, default="", max_length=4),
        ),
        migrations.AddField(
            model_name="menuitem",
            name="available",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="order",
            name="refunded",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="price",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
