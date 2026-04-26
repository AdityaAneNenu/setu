from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0033_add_complaint_resolution_letter_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="gap",
            name="initial_photo_url",
            field=models.URLField(
                blank=True,
                help_text="Initial complaint photo URL captured at submission time",
                max_length=500,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="closure_distance_m",
            field=models.FloatField(
                blank=True,
                help_text="Distance in meters between initial and closure locations",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="resolution_ai_method",
            field=models.CharField(
                blank=True,
                help_text="Method used for AI score (opencv or pillow_fallback)",
                max_length=50,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="resolution_ai_score",
            field=models.FloatField(
                blank=True,
                help_text="AI-derived change score between initial and closure photos (0-1)",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="resolution_review_reason",
            field=models.TextField(
                blank=True,
                help_text="Reason captured when resolution is routed to manual review",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="resolution_time_minutes",
            field=models.FloatField(
                blank=True,
                help_text="Minutes between complaint creation and resolution attempt",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gap",
            name="resolution_type",
            field=models.CharField(
                blank=True,
                help_text="Resolution outcome category: auto or review",
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="gap",
            name="status",
            field=models.CharField(
                choices=[
                    ("open", "Open"),
                    ("in_progress", "In Progress"),
                    ("needs_review", "Needs Review"),
                    ("resolved", "Resolved"),
                ],
                db_index=True,
                default="open",
                max_length=20,
            ),
        ),
    ]
