from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class WheelSegment(models.Model):
    label = models.CharField(max_length=64)
    color = models.CharField(max_length=32, default="#ffffff")
    probability = models.FloatField()
    multiplier = models.FloatField()
    is_high_payout = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.label} x{self.multiplier} ({self.probability:.3f})"


class GameRound(models.Model):
    class GameType(models.TextChoices):
        SPIN = "SPIN", "Spin & Win"
        PREDICT = "PREDICT", "Predict & Win"
        PICKBOX = "PICKBOX", "Pick a Box"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="game_rounds",
    )
    game_type = models.CharField(max_length=16, choices=GameType.choices)
    stake = models.DecimalField(max_digits=14, decimal_places=2)
    result_label = models.CharField(max_length=64)
    multiplier = models.FloatField()
    win_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_win = models.BooleanField(default=False)
    extra_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.game_type} {self.stake} -> {self.win_amount}"

    @property
    def house_profit(self) -> Decimal:
        return Decimal(self.stake) - Decimal(self.win_amount)
