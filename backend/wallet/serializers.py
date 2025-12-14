from __future__ import annotations

from rest_framework import serializers

from .models import Wallet


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ("balance", "bonus_balance", "has_made_real_deposit")
        read_only_fields = fields
