from __future__ import annotations

from rest_framework import generics, permissions

from .models import Transaction
from .serializers import TransactionSerializer


class TransactionListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return Transaction.objects.filter(user=self.request.user).order_by("-created_at")


class AdminDepositListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):  # type: ignore[override]
        return Transaction.objects.filter(type=Transaction.Type.DEPOSIT).order_by("-created_at")


class AdminWithdrawalListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):  # type: ignore[override]
        return Transaction.objects.filter(type=Transaction.Type.WITHDRAWAL).order_by("-created_at")
