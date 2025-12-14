from __future__ import annotations

from rest_framework import serializers

from .models import ProfitAdjustmentLog


class ProfitAdjustmentLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfitAdjustmentLog
        fields = (
            "id",
            "game_type",
            "created_at",
            "auto",
            "margin_short",
            "margin_long",
            "intensity",
            "parameters_before",
            "parameters_after",
            "note",
        )
        read_only_fields = fields
