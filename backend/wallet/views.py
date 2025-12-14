from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Wallet
from .serializers import WalletSerializer


class WalletDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        wallet = request.user.wallet
        data = WalletSerializer(wallet).data
        return Response(data)


class AdminResetWalletsView(APIView):
    """Admin-only endpoint to reset all wallet balances to 0."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, *args, **kwargs):
        updated = Wallet.objects.all().update(balance=0, bonus_balance=0)
        return Response({"detail": f"Reset {updated} wallets to 0"})
