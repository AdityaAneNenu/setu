from django.core.management.base import BaseCommand
from core.models import Village, Gap

class Command(BaseCommand):
    help = 'Add sample data for villages and gaps'

    def handle(self, *args, **kwargs):
        # Clear existing data
        self.stdout.write('Clearing existing data...')
        Gap.objects.all().delete()
        Village.objects.all().delete()

        # Create villages
        self.stdout.write('Creating villages...')
        village_a = Village.objects.create(name='Village A')
        village_b = Village.objects.create(name='Village B')
        village_c = Village.objects.create(name='Village C')

        # Create gaps for Village A (7 gaps - all open)
        self.stdout.write('Creating gaps for Village A...')
        Gap.objects.create(
            village=village_a,
            description='Poor road conditions affecting transportation',
            gap_type='road',
            severity='high',
            status='open',
            recommendations='Repair main road and add drainage system'
        )
        Gap.objects.create(
            village=village_a,
            description='Insufficient water supply during summer',
            gap_type='water',
            severity='high',
            status='open',
            recommendations='Install additional water storage tanks'
        )
        Gap.objects.create(
            village=village_a,
            description='No proper sanitation facilities in public areas',
            gap_type='sanitation',
            severity='high',
            status='open',
            recommendations='Build community toilets with proper sewage system'
        )
        Gap.objects.create(
            village=village_a,
            description='Frequent power outages affecting daily life',
            gap_type='electricity',
            severity='medium',
            status='open',
            recommendations='Upgrade electrical infrastructure and install backup systems'
        )
        Gap.objects.create(
            village=village_a,
            description='School building needs renovation',
            gap_type='education',
            severity='medium',
            status='open',
            recommendations='Renovate school building and add new classrooms'
        )
        Gap.objects.create(
            village=village_a,
            description='Lack of primary health center',
            gap_type='health',
            severity='high',
            status='open',
            recommendations='Establish primary health center with basic medical facilities'
        )
        Gap.objects.create(
            village=village_a,
            description='Street lighting inadequate',
            gap_type='electricity',
            severity='low',
            status='open',
            recommendations='Install LED street lights on main roads'
        )

        # Create gaps for Village B (2 gaps - 1 open, 1 resolved)
        self.stdout.write('Creating gaps for Village B...')
        Gap.objects.create(
            village=village_b,
            description='Water supply pipeline leakage',
            gap_type='water',
            severity='high',
            status='open',
            recommendations='Replace old pipeline sections and add pressure monitoring'
        )
        Gap.objects.create(
            village=village_b,
            description='Road connectivity to main highway',
            gap_type='road',
            severity='medium',
            status='resolved',
            recommendations='Completed road construction connecting to main highway'
        )

        # Village C has no gaps

        self.stdout.write(self.style.SUCCESS('Successfully added sample data!'))
        self.stdout.write(f'Created {Village.objects.count()} villages')
        self.stdout.write(f'Created {Gap.objects.count()} gaps')
