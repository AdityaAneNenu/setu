from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0032_add_complaint_document_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="complaint",
            name="resolution_letter_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="complaints/resolution_letters/",
                help_text="Resolution letter image for photo/document complaints",
            ),
        ),
    ]

