from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models


class Transaction(models.Model):
    class Type(models.TextChoices):
        DEPOSIT = "DEPOSIT", "Deposit"
        WITHDRAWAL = "WITHDRAWAL", "Withdrawal"
        GAME_STAKE = "GAME_STAKE", "Game stake"
        GAME_WIN = "GAME_WIN", "Game win"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        BONUS_CREDIT = "BONUS_CREDIT", "Bonus credit"
        REFERRAL_BONUS = "REFERRAL_BONUS", "Referral bonus"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reference_id = models.CharField(max_length=128, blank=True, null=True)
    provider = models.CharField(max_length=64, blank=True, null=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return f"{self.type} {self.amount} ({self.status})"

    @property
    def is_success(self) -> bool:
        return self.status == self.Status.SUCCESS

    @property
    def signed_amount(self) -> Decimal:
        if self.type in {self.Type.DEPOSIT, self.Type.GAME_WIN, self.Type.ADJUSTMENT}:
            return self.amount
        return -self.amount
