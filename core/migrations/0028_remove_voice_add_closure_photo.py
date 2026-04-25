from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0027_hash_existing_voice_codes"),
    ]

    operations = [
        migrations.DeleteModel(
            name="VoiceVerificationLog",
        ),
        migrations.RemoveField(
            model_name="gap",
            name="voice_code",
        ),
        migrations.RemoveField(
            model_name="complaint",
            name="voice_code",
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_photo_url",
            field=models.URLField(
                blank=True,
                null=True,
                max_length=500,
                help_text="Cloudinary URL of the geo-tagged closure photo taken on-site",
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_latitude",
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=9,
                decimal_places=6,
                help_text="GPS latitude where closure photo was taken",
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_longitude",
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=9,
                decimal_places=6,
                help_text="GPS longitude where closure photo was taken",
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_photo_timestamp",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Timestamp when closure photo was captured on-site",
            ),
        ),
    ]

