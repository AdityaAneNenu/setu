from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0035_gap_offline_idempotency_accuracy"),
    ]

    operations = [
        migrations.AlterField(
            model_name="gap",
            name="resolution_client_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Client-generated local ID used for idempotent resolution sync",
                max_length=120,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="client_submission_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Client-generated ID used for idempotent mobile complaint submission",
                max_length=120,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_client_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Client-generated ID used for idempotent mobile complaint closure",
                max_length=120,
                null=True,
                unique=True,
            ),
        ),
    ]
