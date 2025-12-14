from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import timedelta
from typing import List, Tuple

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from games.models import GameRound, WheelSegment

from .models import ProfitAdjustmentLog


@dataclass
class SegmentState:
    id: int
    label: str
    probability: float
    multiplier: float
    is_high_payout: bool


def _compute_margin(queryset) -> Tuple[float | None, float, float]:
    agg = queryset.aggregate(
        total_stakes=Sum("stake"),
        total_payouts=Sum("win_amount"),
    )
    total_stakes = float(agg.get("total_stakes") or 0.0)
    total_payouts = float(agg.get("total_payouts") or 0.0)

    if total_stakes <= 0:
        return None, total_stakes, total_payouts

    margin = (total_stakes - total_payouts) / total_stakes
    return margin, total_stakes, total_payouts


@shared_task
def evaluate_house_margin() -> None:
    """Periodic task that evaluates and adjusts wheel parameters.

    The algorithm follows the specification in the Bahati Yangu
    requirements: keep the house margin >= target by gently adjusting
    probabilities and multipliers for high-payout segments.
    """

    now = timezone.now()
    short_window_minutes = int(getattr(settings, "HOUSE_SHORT_WINDOW_MINUTES", 10))
    long_window_hours = int(getattr(settings, "HOUSE_LONG_WINDOW_HOURS", 24))

    short_since = now - timedelta(minutes=short_window_minutes)
    long_since = now - timedelta(hours=long_window_hours)

    for game_type, _label in GameRound.GameType.choices:
        if game_type != GameRound.GameType.SPIN:
            # For now we only auto-adjust Spin & Win; Predict & Win can be
            # configured manually via admin.
            continue

        short_qs = GameRound.objects.filter(game_type=game_type, created_at__gte=short_since)
        long_qs = GameRound.objects.filter(game_type=game_type, created_at__gte=long_since)

        margin_short, total_stakes_short, total_payouts_short = _compute_margin(short_qs)
        margin_long, total_stakes_long, total_payouts_long = _compute_margin(long_qs)

        # If there is not enough data yet, skip adjustments.
        if margin_short is None and margin_long is None:
            continue

        margins = [m for m in [margin_short, margin_long] if m is not None]
        current_margin = min(margins) if margins else None
        if current_margin is None:
            continue

        target = float(getattr(settings, "HOUSE_TARGET_MARGIN", 0.75))
        if current_margin >= target:
            continue

        gap = target - current_margin
        normalizer = float(getattr(settings, "HOUSE_MARGIN_NORMALIZER", 0.2))
        base_intensity = gap / normalizer if normalizer > 0 else gap
        intensity = max(0.05, min(base_intensity, 0.5))

        # Rate limiting to avoid oscillation.
        from django.utils import timezone as _tz

        one_hour_ago = now - _tz.timedelta(hours=1)
        max_per_hour = int(
            getattr(settings, "HOUSE_MAX_AUTOMATED_ADJUSTMENTS_PER_HOUR", 12)
        )
        recent_count = ProfitAdjustmentLog.objects.filter(
            game_type=game_type,
            created_at__gte=one_hour_ago,
        ).count()
        if recent_count >= max_per_hour:
            continue

        segments = list(WheelSegment.objects.all().order_by("order", "id"))
        if not segments:
            continue

        high_threshold = float(
            getattr(settings, "HOUSE_HIGH_MULTIPLIER_THRESHOLD", 5.0)
        )
        min_multiplier = float(getattr(settings, "HOUSE_MIN_MULTIPLIER", 1.1))
        w_mult = float(getattr(settings, "HOUSE_W_MULTIPLIER", 0.6))
        w_prob = float(getattr(settings, "HOUSE_W_PROB", 0.4))

        high_indices: List[int] = [
            idx for idx, s in enumerate(segments) if s.multiplier >= high_threshold
        ]
        low_indices: List[int] = [
            idx for idx, s in enumerate(segments) if s.multiplier < high_threshold
        ]

        if not high_indices or not low_indices:
            continue

        def project(intensity_value: float):
            prob_delta = intensity_value * w_prob

            probs = [float(s.probability) for s in segments]
            mults = [float(s.multiplier) for s in segments]

            removed_total = 0.0
            for idx in high_indices:
                p = probs[idx]
                removed = p * prob_delta
                probs[idx] = max(0.0, p - removed)
                removed_total += removed

            add_share = removed_total / len(low_indices)
            for idx in low_indices:
                probs[idx] += add_share

            total_prob = sum(probs) or 1.0
            probs = [p / total_prob for p in probs]

            for idx in high_indices:
                m = mults[idx]
                factor = 1.0 - intensity_value * w_mult
                mults[idx] = max(min_multiplier, m * factor)

            exp_payout_factor = sum(p * m for p, m in zip(probs, mults))
            margin_projected = 1.0 - exp_payout_factor

            return probs, mults, margin_projected

        # Try up to 3 times to reach target margin in projection.
        best_probs: List[float] | None = None
        best_mults: List[float] | None = None
        best_margin = current_margin
        current_intensity = intensity

        for _ in range(3):
            probs, mults, margin_projected = project(current_intensity)
            best_probs, best_mults, best_margin = probs, mults, margin_projected
            if margin_projected >= target:
                break
            current_intensity = min(current_intensity * 1.2, 0.5)

        if best_probs is None or best_mults is None:
            continue

        alpha = min(0.25, current_intensity)
        applied_probs: List[float] = []
        applied_mults: List[float] = []
        for idx, seg in enumerate(segments):
            p_current = float(seg.probability)
            m_current = float(seg.multiplier)
            p_new = (1.0 - alpha) * p_current + alpha * best_probs[idx]
            m_new = (1.0 - alpha) * m_current + alpha * best_mults[idx]
            applied_probs.append(p_new)
            applied_mults.append(m_new)

        before_state = [
            asdict(
                SegmentState(
                    id=s.id,
                    label=s.label,
                    probability=float(s.probability),
                    multiplier=float(s.multiplier),
                    is_high_payout=s.is_high_payout,
                )
            )
            for s in segments
        ]

        with transaction.atomic():
            for seg, p_new, m_new in zip(segments, applied_probs, applied_mults):
                seg.probability = p_new
                seg.multiplier = m_new
                seg.save(update_fields=["probability", "multiplier"])

            after_state = [
                asdict(
                    SegmentState(
                        id=s.id,
                        label=s.label,
                        probability=float(s.probability),
                        multiplier=float(s.multiplier),
                        is_high_payout=s.is_high_payout,
                    )
                )
                for s in segments
            ]

            ProfitAdjustmentLog.objects.create(
                game_type=game_type,
                auto=True,
                margin_short=margin_short or 0.0,
                margin_long=margin_long or 0.0,
                intensity=current_intensity,
                parameters_before=before_state,
                parameters_after=after_state,
                note="auto-adjust",
            )
