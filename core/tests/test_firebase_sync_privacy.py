from unittest.mock import Mock, patch

from django.test import TestCase

from core.firebase_utils import firestore, sync_gap_to_firestore
from core.models import Gap, Village


class FirestoreGapSyncPrivacyTests(TestCase):
    @patch("core.firebase_utils.get_firestore_client")
    def test_sync_gap_to_firestore_explicitly_deletes_voice_code_field(
        self, mock_get_firestore_client
    ):
        mock_db = Mock()
        mock_doc_ref = Mock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref
        mock_get_firestore_client.return_value = mock_db

        village = Village.objects.create(name="Firestore Privacy Village")
        gap = Gap.objects.create(
            village=village,
            description="Legacy cleanup gap",
            gap_type="water",
            severity="medium",
            input_method="voice",
        )

        sync_gap_to_firestore(gap)

        payload = mock_doc_ref.set.call_args.args[0]
        self.assertIn("voice_code", payload)
        self.assertEqual(payload["voice_code"], firestore.DELETE_FIELD)

    @patch("core.firebase_utils.get_firestore_client")
    def test_sync_gap_to_firestore_reuses_existing_mobile_document(
        self, mock_get_firestore_client
    ):
        mock_db = Mock()
        mock_collection = Mock()
        mock_existing_doc = Mock()
        mock_existing_ref = Mock()
        mock_existing_doc.reference = mock_existing_ref

        mock_collection.where.return_value.limit.return_value.stream.return_value = [
            mock_existing_doc
        ]
        mock_db.collection.return_value = mock_collection
        mock_get_firestore_client.return_value = mock_db

        village = Village.objects.create(name="Linked Gap Village")
        gap = Gap.objects.create(
            village=village,
            description="Gap synced from mobile",
            gap_type="road",
            severity="high",
        )

        sync_gap_to_firestore(gap)

        mock_existing_ref.set.assert_called_once()
        mock_collection.document.assert_not_called()
