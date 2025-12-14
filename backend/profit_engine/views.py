from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from datetime import datetime
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


def _compute_margin_stats_since(start_dt):
    data = {}
    for game_type, label in GameRound.GameType.choices:
        qs = GameRound.objects.filter(game_type=game_type, created_at__gte=start_dt)
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

        # Filter by STATS_RESET_DATE to allow resetting stats without deleting history
        reset_date_str = getattr(settings, "STATS_RESET_DATE", None)
        reset_date = None
        if reset_date_str:
            try:
                reset_date = datetime.fromisoformat(reset_date_str)
            except ValueError:
                pass

        withdrawals = Transaction.objects.filter(type=Transaction.Type.WITHDRAWAL)
        if reset_date:
            withdrawals = withdrawals.filter(created_at__gte=reset_date)
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
        if reset_date:
            deposits = deposits.filter(created_at__gte=reset_date)
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

        net_wallet_balance = float(deposit_stats["total_amount"] - withdrawal_stats["total_amount"])
        wallet_stats = {
            "total_balance": net_wallet_balance,
            "total_bonus_balance": 0.0,
            "total_wallet_value": net_wallet_balance,
        }

        now = timezone.now()
        start_of_day = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_stats = _compute_margin_stats_since(start_of_day)
        daily_targets = {
            game_type: (daily_stats[game_type]["margin"] is not None and daily_stats[game_type]["margin"] >= float(getattr(settings, "HOUSE_TARGET_MARGIN", 0.75)))
            for game_type, _ in GameRound.GameType.choices
        }
        daily_total = len(daily_targets)
        daily_met = sum(1 for v in daily_targets.values() if v)

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
                "wallet_stats": wallet_stats,
                "daily": {
                    "date": str(timezone.localdate()),
                    "margin": daily_stats,
                    "targets_met": daily_targets,
                    "met_count": daily_met,
                    "total_games": daily_total,
                    "all_met": daily_met == daily_total,
                },
            }
        )
