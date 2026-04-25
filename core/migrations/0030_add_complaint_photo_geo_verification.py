from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0029_add_closure_selfie_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="complaint",
            name="complaintee_photo",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="complaints/complaintee_photos/",
                help_text="Photo of the complaintee captured at complaint time",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="submission_latitude",
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=9,
                decimal_places=6,
                help_text="GPS latitude captured at complaint submission time",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="submission_longitude",
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=9,
                decimal_places=6,
                help_text="GPS longitude captured at complaint submission time",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_selfie",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="complaints/closure_selfies/",
                help_text="Closure-time selfie of complaintee for verification",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_latitude",
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=9,
                decimal_places=6,
                help_text="GPS latitude captured at complaint closure time",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_longitude",
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=9,
                decimal_places=6,
                help_text="GPS longitude captured at complaint closure time",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_timestamp",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Timestamp when closure selfie was captured",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_distance_m",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Distance between submission GPS and closure GPS (meters)",
            ),
        ),
        migrations.AddField(
            model_name="complaint",
            name="closure_selfie_match_score",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Similarity score between submission photo and closure selfie (0-1)",
            ),
        ),
    ]

