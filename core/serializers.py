from rest_framework import serializers
from .models import QRSubmission, Village, Complaint, PostOffice


class QRSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for QR code submissions from mobile app"""

    person_photo_base64 = serializers.CharField(
        write_only=True, required=False, help_text="Base64 encoded photo"
    )
    village_name = serializers.CharField(max_length=200)

    class Meta:
        model = QRSubmission
        fields = [
            "submission_uuid",
            "qr_code",
            "person_name",
            "person_photo",
            "person_photo_base64",
            "phone_number",
            "village_name",
            "latitude",
            "longitude",
            "form_type",
            "additional_data",
            "mobile_created_at",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        # Handle base64 photo if provided
        photo_base64 = validated_data.pop("person_photo_base64", None)
        village_name = validated_data.pop("village_name")

        # Try to find existing village or create new one
        village = None
        if village_name:
            village, created = Village.objects.get_or_create(name=village_name)
            validated_data["village"] = village

        validated_data["village_name"] = village_name

        if photo_base64:
            # Handle base64 photo conversion
            import base64
            from django.core.files.base import ContentFile
            import uuid

            try:
                format, imgstr = photo_base64.split(";base64,")
                ext = format.split("/")[-1]
                photo_file = ContentFile(
                    base64.b64decode(imgstr), name=f"qr_photo_{uuid.uuid4()}.{ext}"
                )
                validated_data["person_photo"] = photo_file
            except Exception as e:
                # Log error but continue with submission
                print(f"Error processing photo: {e}")

        return super().create(validated_data)


class VillageSerializer(serializers.ModelSerializer):
    """Simple village serializer for mobile app"""

    class Meta:
        model = Village
        fields = ["id", "name"]


class ComplaintSerializer(serializers.ModelSerializer):
    """Serializer for Complaint model"""

    class Meta:
        model = Complaint
        fields = "__all__"


class PostOfficeSerializer(serializers.ModelSerializer):
    """Serializer for PostOffice model"""

    class Meta:
        model = PostOffice
        fields = "__all__"
