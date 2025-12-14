from __future__ import annotations

from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Show basic user info for debugging (email, mpesa_number, role flags)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)

    def handle(self, *args, **options):
        email: str = options["email"].strip().lower()
        user = User.objects.get(email=email)
        self.stdout.write(
            f"email={user.email} mpesa={user.mpesa_number} staff={user.is_staff} superuser={user.is_superuser}"
        )
