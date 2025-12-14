from __future__ import annotations

import json

import requests
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Test IntaSend checkout endpoint from inside the server environment and print raw status/body."

    def add_arguments(self, parser):
        parser.add_argument("--amount", type=float, default=50.0)
        parser.add_argument("--email", default="latycia@bahati.com")
        parser.add_argument("--phone", default="254792619069")
        parser.add_argument("--api-ref", default="debug-cli")

    def handle(self, *args, **options):
        base = "https://sandbox.intasend.com/api/v1" if settings.INTASEND_ENV != "live" else "https://payment.intasend.com/api/v1"
        url = f"{base}/checkout/"

        payload = {
            "amount": options["amount"],
            "currency": "KES",
            "email": options["email"],
            "phone_number": options["phone"],
            "callback_url": "https://backend-production-17c0.up.railway.app/api/payments/webhook",
            "host": "https://bahati-yangu.web.app",
            "redirect_url": "https://bahati-yangu.web.app",
            "api_ref": options["api_ref"],
            "public_key": settings.INTASEND_PUBLIC_KEY,
        }

        attempts = [
            ("no_auth", {"Content-Type": "application/json"}),
            (
                "bearer_public",
                {
                    "Authorization": f"Bearer {settings.INTASEND_PUBLIC_KEY}",
                    "Content-Type": "application/json",
                },
            ),
            (
                "bearer_secret",
                {
                    "Authorization": f"Bearer {settings.INTASEND_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
            ),
        ]

        self.stdout.write(f"URL: {url}")
        for name, headers in attempts:
            resp = requests.post(url, json=payload, headers=headers, timeout=30)
            self.stdout.write(f"\n=== {name} ===")
            self.stdout.write(f"Status: {resp.status_code}")
            self.stdout.write("Body: " + resp.text)
