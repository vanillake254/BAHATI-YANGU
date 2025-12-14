from __future__ import annotations

from rest_framework import serializers

from .models import GameRound, WheelSegment


class WheelSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = WheelSegment
        fields = (
            "id",
            "label",
            "color",
            "probability",
            "multiplier",
            "is_high_payout",
            "order",
        )


class SpinResultSerializer(serializers.Serializer):
    stake = serializers.DecimalField(max_digits=14, decimal_places=2)
    result_label = serializers.CharField()
    multiplier = serializers.FloatField()
    win_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)


class PredictResultSerializer(serializers.Serializer):
    stake = serializers.DecimalField(max_digits=14, decimal_places=2)
    prediction = serializers.CharField()
    outcome = serializers.CharField()
    is_win = serializers.BooleanField()
    multiplier = serializers.FloatField()
    win_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)


class PickBoxResultSerializer(serializers.Serializer):
    stake = serializers.DecimalField(max_digits=14, decimal_places=2)
    choice = serializers.CharField()
    revealed_label = serializers.CharField()
    multiplier = serializers.FloatField()
    win_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)


class GameRoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameRound
        fields = (
            "id",
            "game_type",
            "stake",
            "result_label",
            "multiplier",
            "win_amount",
            "is_win",
            "created_at",
        )
        read_only_fields = fields
