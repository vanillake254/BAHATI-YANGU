from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import WalletSerializer


class WalletDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        wallet = request.user.wallet
        data = WalletSerializer(wallet).data
        return Response(data)
