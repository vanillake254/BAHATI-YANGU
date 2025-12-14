from __future__ import annotations

import json

from django.core.management.base import BaseCommand

from transactions.models import Transaction


class Command(BaseCommand):
    help = "Print the latest IntaSend-related transaction error/meta for debugging."

    def add_arguments(self, parser):
        parser.add_argument("--type", choices=["DEPOSIT", "WITHDRAWAL"], default="DEPOSIT")

    def handle(self, *args, **options):
        tx_type = options["type"]

        tx = (
            Transaction.objects.filter(provider="intasend", type=tx_type)
            .order_by("-created_at")
            .first()
        )

        if not tx:
            self.stdout.write("No IntaSend transactions found.")
            return

        payload = {
            "id": tx.id,
            "type": tx.type,
            "status": tx.status,
            "amount": str(tx.amount),
            "reference_id": tx.reference_id,
            "created_at": tx.created_at.isoformat(),
            "meta": tx.meta,
        }
        self.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False))
