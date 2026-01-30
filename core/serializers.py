from rest_framework import serializers
from .models import QRSubmission, QRComplaintDetail, Village, Complaint


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


class QRComplaintDetailSerializer(serializers.ModelSerializer):
    """Serializer for complaint details linked to QR submissions"""

    class Meta:
        model = QRComplaintDetail
        fields = [
            "qr_submission",
            "complaint_text",
            "complaint_type",
            "severity",
            "additional_photos",
            "audio_file",
            "created_at",
            "synced_from_mobile",
        ]
        read_only_fields = ["created_at"]


class MobileDataSyncSerializer(serializers.Serializer):
    """Serializer for batch sync from mobile app"""

    qr_submissions = QRSubmissionSerializer(many=True, required=False)
    complaint_details = QRComplaintDetailSerializer(many=True, required=False)

    def create(self, validated_data):
        """Process batch sync data"""
        results = {
            "qr_submissions_created": 0,
            "complaint_details_created": 0,
            "errors": [],
        }

        # Process QR submissions
        qr_submissions_data = validated_data.get("qr_submissions", [])
        for qr_data in qr_submissions_data:
            try:
                # Check if submission already exists
                existing = QRSubmission.objects.filter(
                    submission_uuid=qr_data.get("submission_uuid")
                ).first()

                if not existing:
                    serializer = QRSubmissionSerializer(data=qr_data)
                    if serializer.is_valid():
                        serializer.save()
                        results["qr_submissions_created"] += 1
                    else:
                        results["errors"].append(
                            {
                                "type": "qr_submission",
                                "data": qr_data,
                                "errors": serializer.errors,
                            }
                        )
            except Exception as e:
                results["errors"].append(
                    {"type": "qr_submission", "data": qr_data, "error": str(e)}
                )

        # Process complaint details
        complaint_details_data = validated_data.get("complaint_details", [])
        for detail_data in complaint_details_data:
            try:
                serializer = QRComplaintDetailSerializer(data=detail_data)
                if serializer.is_valid():
                    serializer.save()
                    results["complaint_details_created"] += 1
                else:
                    results["errors"].append(
                        {
                            "type": "complaint_detail",
                            "data": detail_data,
                            "errors": serializer.errors,
                        }
                    )
            except Exception as e:
                results["errors"].append(
                    {"type": "complaint_detail", "data": detail_data, "error": str(e)}
                )

        return results


class VillageSerializer(serializers.ModelSerializer):
    """Simple village serializer for mobile app"""

    class Meta:
        model = Village
        fields = ["id", "name"]
