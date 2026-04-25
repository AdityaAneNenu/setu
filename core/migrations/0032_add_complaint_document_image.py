from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_alter_gap_closure_latitude_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="complaint",
            name="complaint_document_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="complaints/document_photos/",
                help_text="Photo of written complaint document captured at submission",
            ),
        ),
    ]

