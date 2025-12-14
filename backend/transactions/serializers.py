from __future__ import annotations

from rest_framework import serializers

from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = (
            "id",
            "type",
            "amount",
            "status",
            "reference_id",
            "provider",
            "meta",
            "created_at",
        )
        read_only_fields = fields
