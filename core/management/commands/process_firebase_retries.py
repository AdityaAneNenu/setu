"""
Firebase Sync Retry Management Command
Processes failed Firebase sync operations from the cache-based retry queue.
Run this as a cron job every 15-30 minutes to ensure data consistency.

Usage: python manage.py process_firebase_retries
"""

import time
import logging
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.apps import apps
from core.firebase_utils import sync_gap_to_firestore

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process Firebase sync retry queue"

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-retries",
            type=int,
            default=3,
            help="Maximum retry attempts per item (default: 3)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be retried without actually processing",
        )

    def handle(self, *args, **options):
        max_retries = options["max_retries"]
        dry_run = options["dry_run"]

        self.stdout.write("🔄 Starting Firebase retry queue processing...")

        # Get all retry keys from cache
        retry_keys = self._get_retry_keys()

        if not retry_keys:
            self.stdout.write(self.style.SUCCESS("✅ No items in retry queue"))
            return

        self.stdout.write(f"📋 Found {len(retry_keys)} items in retry queue")

        processed = 0
        succeeded = 0
        failed = 0

        for key in retry_keys:
            retry_data = cache.get(key)
            if not retry_data:
                continue

            processed += 1
            gap_id = retry_data["gap_id"]
            attempts = retry_data.get("attempts", 1)

            self.stdout.write(
                f"Processing Gap {gap_id} (attempt {attempts}/{max_retries})"
            )

            if dry_run:
                self.stdout.write(
                    f"  [DRY RUN] Would retry Firebase sync for Gap {gap_id}"
                )
                continue

            # Skip if max retries exceeded
            if attempts > max_retries:
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⚠️ Max retries exceeded for Gap {gap_id}, removing from queue"
                    )
                )
                cache.delete(key)
                failed += 1
                continue

            # Attempt Firebase sync
            try:
                Gap = apps.get_model("core", "Gap")
                gap = Gap.objects.get(id=gap_id)
                sync_gap_to_firestore(gap)

                # Success - remove from retry queue
                cache.delete(key)
                succeeded += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  ✅ Successfully synced Gap {gap_id}")
                )

            except Gap.DoesNotExist:
                # Gap no longer exists - remove from queue
                cache.delete(key)
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⚠️ Gap {gap_id} not found, removing from queue"
                    )
                )

            except Exception as e:
                # Update retry count and put back in queue
                retry_data["attempts"] = attempts + 1
                retry_data["last_error"] = str(e)
                retry_data["last_attempt"] = time.time()

                # Exponential backoff - increase TTL based on attempts
                backoff_ttl = min(86400, 3600 * (2**attempts))  # Max 24h
                cache.set(key, retry_data, backoff_ttl)

                self.stdout.write(
                    self.style.ERROR(f"  ❌ Retry failed for Gap {gap_id}: {str(e)}")
                )
                failed += 1

        # Summary
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(f"📊 Firebase Retry Queue Processing Summary:")
        self.stdout.write(f"   Processed: {processed}")
        self.stdout.write(f"   Succeeded: {succeeded}")
        self.stdout.write(f"   Failed: {failed}")

        if succeeded > 0:
            self.stdout.write(
                self.style.SUCCESS(f"✅ Successfully processed {succeeded} items")
            )

        if failed > 0:
            self.stdout.write(self.style.WARNING(f"⚠️ {failed} items need more retries"))

    def _get_retry_keys(self):
        """Get all Firebase retry keys from cache"""
        # This is cache backend specific - works with Redis and Memcached
        try:
            # Try Redis backend first
            if hasattr(cache, "_cache") and hasattr(cache._cache, "keys"):
                return [
                    key.decode("utf-8") if isinstance(key, bytes) else key
                    for key in cache._cache.keys("firebase_retry_*")
                ]
        except:
            pass

        # Fallback: maintain a separate index of retry keys
        retry_index = cache.get("firebase_retry_index", set())
        return list(retry_index)
