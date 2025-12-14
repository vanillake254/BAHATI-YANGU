from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from games.models import GameRound
from transactions.models import Transaction

from .models import ProfitAdjustmentLog
from .serializers import ProfitAdjustmentLogSerializer


def _compute_margin_stats(window_minutes: int | None = None, window_hours: int | None = None):
    now = timezone.now()
    filters = {}
    if window_minutes is not None:
        filters["created_at__gte"] = now - timezone.timedelta(minutes=window_minutes)
    if window_hours is not None:
        filters["created_at__gte"] = now - timezone.timedelta(hours=window_hours)

    data = {}
    for game_type, label in GameRound.GameType.choices:
        qs = GameRound.objects.filter(game_type=game_type, **filters)
        agg_stakes = qs.aggregate(total=Sum("stake"))
        agg_payouts = qs.aggregate(total=Sum("win_amount"))
        total_stakes = float(agg_stakes.get("total") or 0.0)
        total_payouts = float(agg_payouts.get("total") or 0.0)

        if total_stakes > 0:
            margin = (total_stakes - total_payouts) / total_stakes
        else:
            margin = None

        data[game_type] = {
            "label": label,
            "total_stakes": total_stakes,
            "total_payouts": total_payouts,
            "margin": margin,
        }

    return data


class ProfitStatusView(APIView):
    """Status endpoint for admin dashboards.

    Returns current short and long window margins plus latest
    adjustments for each game type.
    """

    permission_classes = [permissions.IsAdminUser]

    def get(self, request, *args, **kwargs):
        short_window_minutes = int(
            getattr(settings, "HOUSE_SHORT_WINDOW_MINUTES", 10)
        )
        long_window_hours = int(getattr(settings, "HOUSE_LONG_WINDOW_HOURS", 24))

        short_stats = _compute_margin_stats(window_minutes=short_window_minutes)
        long_stats = _compute_margin_stats(window_hours=long_window_hours)

        latest_logs = {
            game_type: ProfitAdjustmentLogSerializer(
                ProfitAdjustmentLog.objects.filter(game_type=game_type)
                .order_by("-created_at")
                .first()
            ).data
            if ProfitAdjustmentLog.objects.filter(game_type=game_type).exists()
            else None
            for game_type, _ in GameRound.GameType.choices
        }

        User = get_user_model()
        user_stats = {
            "total_users": User.objects.count(),
        }

        withdrawals = Transaction.objects.filter(type=Transaction.Type.WITHDRAWAL)
        withdrawal_stats = {
            "pending": withdrawals.filter(status=Transaction.Status.PENDING).count(),
            "success": withdrawals.filter(status=Transaction.Status.SUCCESS).count(),
            "failed": withdrawals.filter(status=Transaction.Status.FAILED).count(),
            "total_amount": float(
                withdrawals.filter(status=Transaction.Status.SUCCESS)
                .aggregate(total=Sum("amount"))
                .get("total")
                or 0.0
            ),
        }

        deposits = Transaction.objects.filter(type=Transaction.Type.DEPOSIT)
        deposit_stats = {
            "pending": deposits.filter(status=Transaction.Status.PENDING).count(),
            "success": deposits.filter(status=Transaction.Status.SUCCESS).count(),
            "failed": deposits.filter(status=Transaction.Status.FAILED).count(),
            "total_amount": float(
                deposits.filter(status=Transaction.Status.SUCCESS)
                .aggregate(total=Sum("amount"))
                .get("total")
                or 0.0
            ),
        }

        return Response(
            {
                "target_margin": float(
                    getattr(settings, "HOUSE_TARGET_MARGIN", 0.75)
                ),
                "short_window_minutes": short_window_minutes,
                "long_window_hours": long_window_hours,
                "margin_short": short_stats,
                "margin_long": long_stats,
                "latest_adjustments": latest_logs,
                "user_stats": user_stats,
                "deposit_stats": deposit_stats,
                "withdrawal_stats": withdrawal_stats,
            }
        )
