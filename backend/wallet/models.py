from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F


class Wallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Bonus funds granted by the house (signup, promos). These are used for
    # play before the first real-money deposit and are not withdrawable.
    bonus_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Tracks whether this user has ever completed a real-money deposit. Until
    # this is true, withdrawals are blocked and only bonus_balance is used.
    has_made_real_deposit = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return f"Wallet({self.user.email})"

    def can_afford(self, amount: Decimal) -> bool:
        return self.balance >= amount

    def adjust_balance(self, delta: Decimal) -> None:
        self.balance = F("balance") + Decimal(delta)
        self.save(update_fields=["balance"])
        self.refresh_from_db(fields=["balance"])

    def can_afford_bonus(self, amount: Decimal) -> bool:
        return self.bonus_balance >= amount

    def adjust_bonus_balance(self, delta: Decimal) -> None:
        self.bonus_balance = F("bonus_balance") + Decimal(delta)
        self.save(update_fields=["bonus_balance"])
        self.refresh_from_db(fields=["bonus_balance"])
