from __future__ import annotations

from django.core.management.base import BaseCommand

from accounts.models import User
from accounts.validators import normalize_mpesa_number


class Command(BaseCommand):
    help = "Create or update a superuser with the provided credentials."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--mpesa", default="254700000000")

    def handle(self, *args, **options):
        email: str = options["email"].strip().lower()
        password: str = options["password"]
        mpesa: str = normalize_mpesa_number(options["mpesa"].strip())

        user = User.objects.filter(email=email).first()
        created = False

        if user is None:
            user = User.objects.create_superuser(email=email, mpesa_number=mpesa, password=password)
            created = True
        else:
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.mpesa_number = mpesa
            user.set_password(password)
            user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"{('CREATED' if created else 'UPDATED')} superuser: {user.email} mpesa={user.mpesa_number} staff={user.is_staff} superuser={user.is_superuser}"
            )
        )
