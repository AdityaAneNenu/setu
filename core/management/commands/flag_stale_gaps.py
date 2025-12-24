import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Gap, Village
from core.email_utils import send_flag_email, TEAM_EMAIL


class Command(BaseCommand):
    help = "Flag gaps that stayed open without moving to in_progress."

    def add_arguments(self, parser):
        parser.add_argument(
            "--manager-days",
            type=int,
            default=7,
            help="Days after which to flag manager for open gaps.",
        )
        parser.add_argument(
            "--authority-days",
            type=int,
            default=14,
            help="Days after which to flag highest authority.",
        )
        parser.add_argument(
            "--create-test",
            action="store_true",
            help="Create two test gaps: 7 days old and 14 days old (status=open).",
        )

    def handle(self, *args, **options):
        manager_days = options["manager_days"]
        authority_days = options["authority_days"]
        create_test = options["create_test"]

        if create_test:
            self._create_test_gaps()

        now = timezone.now()
        manager_cutoff = now - datetime.timedelta(days=manager_days)
        authority_cutoff = now - datetime.timedelta(days=authority_days)

        flagged_manager = 0
        flagged_authority = 0

        open_gaps = Gap.objects.filter(status="open")

        for gap in open_gaps:
            # Escalate to authority
            if (
                gap.created_at <= authority_cutoff
                and gap.authority_flagged_at is None
            ):
                self._flag_authority(gap)
                flagged_authority += 1
                continue

            # Flag manager
            if (
                gap.created_at <= manager_cutoff
                and gap.manager_flagged_at is None
            ):
                self._flag_manager(gap)
                flagged_manager += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Flagging complete. Manager flagged: {flagged_manager}, Authority flagged: {flagged_authority}"
            )
        )

    def _flag_manager(self, gap: Gap):
        send_flag_email(
            subject=f"[FLAG] Gap #{gap.id} still open",
            message=(
                f"Gap #{gap.id} in village {gap.village.name} remains OPEN.\n"
                f"Type: {gap.gap_type}\n"
                f"Severity: {gap.severity}\n"
                f"Description: {gap.description[:200]}...\n"
                f"Please move to 'in_progress' or update status."
            ),
            recipients=[TEAM_EMAIL],
        )
        gap.manager_flagged_at = timezone.now()
        gap.save(update_fields=["manager_flagged_at"])

    def _flag_authority(self, gap: Gap):
        send_flag_email(
            subject=f"[ESCALATION] Gap #{gap.id} still open",
            message=(
                f"Gap #{gap.id} in village {gap.village.name} remains OPEN beyond manager window.\n"
                f"Type: {gap.gap_type}\n"
                f"Severity: {gap.severity}\n"
                f"Description: {gap.description[:200]}...\n"
                f"Please intervene or reassign."
            ),
            recipients=[TEAM_EMAIL],
        )
        gap.authority_flagged_at = timezone.now()
        gap.save(update_fields=["authority_flagged_at"])

    def _create_test_gaps(self):
        village, _ = Village.objects.get_or_create(name="Flag Test Village")
        now = timezone.now()

        # 7 days old
        gap1 = Gap.objects.create(
            village=village,
            description="Test gap pending 7 days",
            gap_type="test",
            severity="medium",
            status="open",
        )
        Gap.objects.filter(id=gap1.id).update(created_at=now - datetime.timedelta(days=7))

        # 14 days old
        gap2 = Gap.objects.create(
            village=village,
            description="Test gap pending 14 days",
            gap_type="test",
            severity="high",
            status="open",
        )
        Gap.objects.filter(id=gap2.id).update(created_at=now - datetime.timedelta(days=14))

        self.stdout.write(self.style.WARNING("Created test gaps at 7 and 14 days age."))