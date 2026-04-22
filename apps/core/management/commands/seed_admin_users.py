import os
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.core.models import Partner


class Command(BaseCommand):
    help = "Create or update the two allowed Gummy Lover's admin users and partner records."

    def handle(self, *args, **options):
        users = [
            {
                "username": "efrain.leyva",
                "email": settings.ALLOWED_ADMIN_USERS["efrain.leyva"],
                "first_name": "Efrain",
                "last_name": "Leyva",
                "partner_code": Partner.Code.A,
                "password": os.environ.get("GUMMY_EFRAIN_PASSWORD", "GummyLovers2026!"),
            },
            {
                "username": "erika.mora",
                "email": settings.ALLOWED_ADMIN_USERS["erika.mora"],
                "first_name": "Erika",
                "last_name": "Mora",
                "partner_code": Partner.Code.B,
                "password": os.environ.get("GUMMY_ERIKA_PASSWORD", "GummyLovers2026!"),
            },
        ]

        User = get_user_model()

        for item in users:
            user, created = User.objects.get_or_create(
                username=item["username"],
                defaults={
                    "email": item["email"],
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
            user.email = item["email"]
            user.first_name = item["first_name"]
            user.last_name = item["last_name"]
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            user.set_password(item["password"])
            user.save()

            partner, _ = Partner.objects.get_or_create(
                code=item["partner_code"],
                defaults={
                    "name": f"{item['first_name']} {item['last_name']}",
                    "initial_capital": Decimal("0.00"),
                    "ownership_percent": Decimal("50.00"),
                    "active": True,
                },
            )
            partner.user = user
            partner.name = f"{item['first_name']} {item['last_name']}"
            partner.ownership_percent = Decimal("50.00")
            partner.active = True
            partner.save()

            status = "created" if created else "updated"
            self.stdout.write(self.style.SUCCESS(f"{item['username']} {status}"))

