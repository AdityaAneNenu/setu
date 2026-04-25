from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0028_remove_voice_add_closure_photo"),
    ]

    operations = [
        migrations.AddField(
            model_name="gap",
            name="closure_selfie_url",
            field=models.URLField(
                blank=True,
                null=True,
                max_length=500,
                help_text="Cloudinary URL of the closure-time selfie (for similarity check)",
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_selfie_match_score",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Selfie similarity score vs original person photo (0-1)",
            ),
        ),
    ]

