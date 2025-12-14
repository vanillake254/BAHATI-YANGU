from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class ProfitAdjustmentLog(models.Model):
    class GameType(models.TextChoices):
        SPIN = "SPIN", "Spin & Win"
        PREDICT = "PREDICT", "Predict & Win"

    game_type = models.CharField(max_length=16, choices=GameType.choices)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    auto = models.BooleanField(default=True)
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="profit_adjustments",
    )
    margin_short = models.FloatField()
    margin_long = models.FloatField()
    intensity = models.FloatField()
    parameters_before = models.JSONField()
    parameters_after = models.JSONField()
    note = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.game_type} adj @ {self.created_at:%Y-%m-%d %H:%M}"
