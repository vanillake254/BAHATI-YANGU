from __future__ import annotations

from decimal import Decimal
from typing import Iterable, List, Optional

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from games.models import GameRound, WheelSegment


def get_margin_for_game(
    game_type: str,
    window_minutes: Optional[int] = None,
    window_hours: Optional[int] = None,
) -> Optional[float]:
    """Compute margin for a single game type over a recent time window.

    Margin = (stakes - payouts) / stakes.
    Returns None if there is not enough data yet.
    """

    now = timezone.now()
    filters = {"game_type": game_type}
    if window_minutes is not None:
        filters["created_at__gte"] = now - timezone.timedelta(minutes=window_minutes)
    if window_hours is not None:
        filters["created_at__gte"] = now - timezone.timedelta(hours=window_hours)

    qs = GameRound.objects.filter(**filters)
    agg_stakes = qs.aggregate(total=Sum("stake"))
    agg_payouts = qs.aggregate(total=Sum("win_amount"))
    total_stakes = float(agg_stakes.get("total") or 0.0)
    total_payouts = float(agg_payouts.get("total") or 0.0)

    if total_stakes <= 0:
        return None

    return (total_stakes - total_payouts) / total_stakes


def get_target_margin() -> float:
    return float(getattr(settings, "HOUSE_TARGET_MARGIN", 0.75))


def get_predict_multiplier_for_margin(margin: Optional[float]) -> Decimal:
    """Choose a prediction multiplier based on current margin.

    - Default / healthy margin (>= target + 0.05): 1.8x
    - Slightly soft margin (target <= m < target + 0.05): 1.7x
    - Below target: 1.6x
    """

    base = Decimal(str(getattr(settings, "PREDICT_BASE_MULTIPLIER", "1.8")))
    target = get_target_margin()

    if margin is None:
        return base

    if margin < target:
        return Decimal("1.6")
    if margin < target + 0.05:
        return Decimal("1.7")
    return base


def adjusted_spin_probabilities(
    segments: Iterable[WheelSegment], margin: Optional[float]
) -> List[float]:
    """Return in-memory adjusted probabilities for the given segments.

    This does NOT write to the database. It simply biases the draw so that
    when margins are soft, loss slices become slightly more likely and
    large wins slightly less likely, while keeping behaviour smooth.
    """

    base_probs: List[float] = [max(0.0, float(s.probability)) for s in segments]

    if not base_probs:
        return []

    # If we have no margin data yet, use base probabilities unchanged.
    if margin is None:
        total = sum(base_probs)
        if total <= 0:
            return base_probs
        return [p for p in base_probs]

    target = get_target_margin()

    def classify(seg: WheelSegment) -> str:
        # Treat strong loss / tiny return slices as "loss" category.
        if seg.multiplier <= 0.5:
            return "loss"
        # High multipliers are "big_win".
        if seg.multiplier >= 3:
            return "big_win"
        return "mid"

    adjusted: List[float] = []
    for seg, p in zip(segments, base_probs):
        category = classify(seg)
        scale = 1.0

        if margin < target:
            # Below target: push more traffic into loss slices, trim big wins.
            if category == "loss":
                scale = 1.15
            elif category == "big_win":
                scale = 0.8
            else:  # mid
                scale = 0.95
        elif margin < target + 0.05:
            # Slightly soft: gentler adjustment.
            if category == "loss":
                scale = 1.05
            elif category == "big_win":
                scale = 0.9
        elif margin > target + 0.1:
            # Very strong margin: allow slightly more mid wins.
            if category == "mid":
                scale = 1.05
            elif category == "big_win":
                scale = 1.02

        adjusted.append(p * scale)

    total = sum(adjusted)
    if total <= 0:
        return base_probs

    # We keep them in the same overall scale used by the caller; they will
    # normalise using this list directly for the random draw.
    return adjusted
