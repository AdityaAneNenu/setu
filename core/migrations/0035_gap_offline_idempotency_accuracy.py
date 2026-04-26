from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0034_gap_ai_resolution_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="gap",
            name="client_local_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Client-generated local ID used for offline idempotent complaint sync",
                max_length=120,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_gps_accuracy_m",
            field=models.FloatField(
                blank=True,
                help_text="GPS accuracy in meters at closure capture time",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="initial_gps_accuracy_m",
            field=models.FloatField(
                blank=True,
                help_text="GPS accuracy in meters at complaint capture time",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="resolution_client_id",
            field=models.CharField(
                blank=True,
                help_text="Client-generated local ID used for idempotent resolution sync",
                max_length=120,
                null=True,
            ),
        ),
    ]
