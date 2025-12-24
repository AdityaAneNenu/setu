from django.core.management.base import BaseCommand
from core.models import Gap


class Command(BaseCommand):
    help = 'Estimates budgets for gaps where budget_allocated is 0 or None'

    def handle(self, *args, **kwargs):
        """
        Budget estimation logic based on gap type and severity:
        
        Base costs (in INR):
        - Water: 500,000 (5 lakhs)
        - Road: 1,000,000 (10 lakhs)
        - Sanitation: 300,000 (3 lakhs)
        - Electricity: 400,000 (4 lakhs)
        - Education: 800,000 (8 lakhs)
        - Health: 1,500,000 (15 lakhs)
        
        Severity multipliers:
        - Low: 0.6x
        - Medium: 1.0x
        - High: 1.5x
        """
        
        # Base budget estimates by infrastructure type
        base_budgets = {
            'water': 500000,
            'road': 1000000,
            'sanitation': 300000,
            'electricity': 400000,
            'education': 800000,
            'health': 1500000,
        }
        
        # Severity multipliers
        severity_multipliers = {
            'low': 0.6,
            'medium': 1.0,
            'high': 1.5,
        }
        
        # Get all gaps without budget or with 0 budget
        gaps_without_budget = Gap.objects.filter(
            budget_allocated__isnull=True
        ) | Gap.objects.filter(budget_allocated=0)
        
        count = gaps_without_budget.count()
        self.stdout.write(f'Found {count} gaps without budget allocation')
        
        updated = 0
        for gap in gaps_without_budget:
            base_budget = base_budgets.get(gap.gap_type, 500000)  # Default 5 lakhs
            multiplier = severity_multipliers.get(gap.severity, 1.0)
            
            estimated_budget = base_budget * multiplier
            
            gap.budget_allocated = estimated_budget
            gap.save()
            
            updated += 1
            self.stdout.write(
                f'Updated {gap.village.name} - {gap.gap_type} ({gap.severity}): '
                f'₹{estimated_budget:,.0f}'
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSuccessfully estimated budgets for {updated} gaps!'
            )
        )
