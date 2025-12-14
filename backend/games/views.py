from __future__ import annotations

import random
from decimal import Decimal

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from transactions.models import Transaction
from profit_engine.logic import (
    adjusted_spin_probabilities,
    get_margin_for_game,
    get_predict_multiplier_for_margin,
)
from wallet.models import Wallet

from .models import GameRound, WheelSegment
from .serializers import (
    GameRoundSerializer,
    PredictResultSerializer,
    PickBoxResultSerializer,
    SpinResultSerializer,
    WheelSegmentSerializer,
)
def ensure_default_wheel() -> None:
    """Seed a sensible default wheel if no segments exist.

    This avoids a blank wheel on fresh installs. The probabilities roughly sum
    to 1.0 and use increasing multipliers for higher-risk slices.
    """

    if WheelSegment.objects.exists():  # pragma: no cover - simple guard
        return

    # User-requested multipliers now: -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 5, 10.
    # Probabilities tuned per user spec while keeping big wins rare but exciting.
    defaults = [
        {"label": "-1.5x", "multiplier": -1.5, "probability": 0.08, "color": "#020617", "is_high_payout": False},
        {"label": "-1x", "multiplier": -1.0, "probability": 0.21, "color": "#0f172a", "is_high_payout": False},
        {"label": "-0.5x", "multiplier": -0.5, "probability": 0.17, "color": "#111827", "is_high_payout": False},
        {"label": "0x", "multiplier": 0.0, "probability": 0.19, "color": "#020617", "is_high_payout": False},
        {"label": "0.5x", "multiplier": 0.5, "probability": 0.11, "color": "#38bdf8", "is_high_payout": False},
        {"label": "1x", "multiplier": 1.0, "probability": 0.08, "color": "#22c55e", "is_high_payout": False},
        {"label": "1.5x", "multiplier": 1.5, "probability": 0.08, "color": "#4ade80", "is_high_payout": False},
        {"label": "2x", "multiplier": 2.0, "probability": 0.06, "color": "#6366f1", "is_high_payout": False},
        {"label": "2.5x", "multiplier": 2.5, "probability": 0.03, "color": "#7c3aed", "is_high_payout": False},
        {"label": "3x", "multiplier": 3.0, "probability": 0.02, "color": "#06b6d4", "is_high_payout": False},
        {"label": "5x", "multiplier": 5.0, "probability": 0.025, "color": "#ec4899", "is_high_payout": True},
        {"label": "10x", "multiplier": 10.0, "probability": 0.015, "color": "#f97316", "is_high_payout": True},
    ]

    for idx, cfg in enumerate(defaults):
        WheelSegment.objects.create(
            label=cfg["label"],
            color=cfg["color"],
            probability=cfg["probability"],
            multiplier=cfg["multiplier"],
            is_high_payout=cfg["is_high_payout"],
            order=idx,
        )


class WheelConfigView(APIView):
    """Return current wheel configuration for the frontend to render."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        ensure_default_wheel()
        segments = WheelSegment.objects.all().order_by("order", "id")
        data = WheelSegmentSerializer(segments, many=True).data
        return Response(data)


class SpinPlayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        stake_raw = request.data.get("stake")
        try:
            stake = Decimal(str(stake_raw))
        except Exception:
            return Response({"detail": "Invalid stake amount."}, status=status.HTTP_400_BAD_REQUEST)

        if stake <= 0:
            return Response({"detail": "Stake must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        wallet: Wallet = request.user.wallet

        ensure_default_wheel()
        segments = list(WheelSegment.objects.all().order_by("order", "id"))
        if not segments:
            return Response({"detail": "Wheel configuration is not available."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Let the profit engine gently bias probabilities based on recent margin,
        # without writing anything back to the database.
        margin_spin_short = get_margin_for_game(GameRound.GameType.SPIN.value, window_minutes=10)
        probs = adjusted_spin_probabilities(segments, margin_spin_short)

        # Welcome bonus boost: for users who haven't made a real deposit yet,
        # slightly bias away from losing segments.
        if not wallet.has_made_real_deposit:
            boosted = []
            for seg, p in zip(segments, probs):
                if seg.multiplier >= 1:
                    boosted.append(p * 1.15)
                elif seg.multiplier > 0:
                    boosted.append(p * 1.05)
                else:
                    boosted.append(p * 0.75)
            probs = boosted
        total_prob = sum(max(0.0, p) for p in probs)
        if total_prob <= 0:
            return Response({"detail": "Invalid wheel configuration."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        rnd = random.random() * total_prob
        cumulative = 0.0
        chosen_segment = segments[-1]
        for seg, p in zip(segments, probs):
            cumulative += max(0.0, p)
            if rnd <= cumulative:
                chosen_segment = seg
                break

        multiplier = Decimal(str(chosen_segment.multiplier))
        win_amount = (stake * multiplier).quantize(Decimal("0.01")) if multiplier > 0 else Decimal("0")
        is_win = win_amount > 0

        # Special handling for -1.5x: treat it as losing 1.5x the stake total.
        # The normal stake is always deducted; here we add an extra 0.5x stake loss.
        extra_loss = Decimal("0")
        if chosen_segment.label == "-1.5x":
            extra_loss = (Decimal("1.5") - Decimal("1.0")) * stake
        total_deduction = stake + extra_loss

        with transaction.atomic():
            if not wallet.has_made_real_deposit:
                playable_bonus = wallet.bonus_balance
                playable_cash = wallet.balance
                if playable_bonus + playable_cash < total_deduction:
                    return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)

                deduct_from_bonus = min(playable_bonus, total_deduction)
                deduct_from_cash = total_deduction - deduct_from_bonus

                if deduct_from_bonus > 0:
                    wallet.adjust_bonus_balance(-deduct_from_bonus)
                if deduct_from_cash > 0:
                    wallet.adjust_balance(-deduct_from_cash)
            else:
                if not wallet.can_afford(total_deduction):
                    return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)
                wallet.adjust_balance(-total_deduction)
            Transaction.objects.create(
                user=request.user,
                type=Transaction.Type.GAME_STAKE,
                amount=total_deduction,
                status=Transaction.Status.SUCCESS,
                provider="internal",
                meta={"game": "SPIN"},
            )

            if is_win:
                if not wallet.has_made_real_deposit and wallet.bonus_balance > 0:
                    wallet.adjust_bonus_balance(win_amount)
                else:
                    wallet.adjust_balance(win_amount)
                Transaction.objects.create(
                    user=request.user,
                    type=Transaction.Type.GAME_WIN,
                    amount=win_amount,
                    status=Transaction.Status.SUCCESS,
                    provider="internal",
                    meta={"game": "SPIN"},
                )

            round_obj = GameRound.objects.create(
                user=request.user,
                game_type=GameRound.GameType.SPIN,
                stake=stake,
                result_label=chosen_segment.label,
                multiplier=float(chosen_segment.multiplier),
                win_amount=win_amount,
                is_win=is_win,
                extra_data={"segment_id": chosen_segment.id},
            )

        wallet.refresh_from_db()
        if wallet.has_made_real_deposit:
            display_balance = wallet.balance
        else:
            display_balance = wallet.balance + wallet.bonus_balance

        resp = SpinResultSerializer(
            {
                "stake": stake,
                "result_label": round_obj.result_label,
                "multiplier": round_obj.multiplier,
                "win_amount": win_amount,
                "balance": display_balance,
            }
        ).data

        return Response(resp, status=status.HTTP_200_OK)


class PickBoxPlayView(APIView):
    """Simple 3-box game with fixed multipliers.

    - Minimum stake: 20 KES
    - Multipliers: X0, X1, X2, X3
    - Probabilities tuned for a house edge (EV < 1):
      X0=0.45, X1=0.30, X2=0.20, X3=0.05
    - Uses same wallet/bonus logic as other games.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        stake_raw = request.data.get("stake")
        choice_raw = request.data.get("choice")

        try:
            stake = Decimal(str(stake_raw))
        except Exception:  # pragma: no cover - simple validation
            return Response({"detail": "Invalid stake amount."}, status=status.HTTP_400_BAD_REQUEST)

        if stake <= 0:
            return Response({"detail": "Stake must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        # Minimum stake 20 KES as requested
        if stake < Decimal("20"):
            return Response({"detail": "Minimum stake for Pick a Box is KES 20."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(choice_raw, str):
            return Response({"detail": "Choice is required."}, status=status.HTTP_400_BAD_REQUEST)

        choice = choice_raw.strip().lower()
        if choice not in {"left", "middle", "right"}:
            return Response(
                {"detail": "Choice must be 'left', 'middle' or 'right'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wallet: Wallet = request.user.wallet

        # Probabilities chosen by admin.
        # EV = 0*0.40 + 1*0.34 + 2*0.16 + 3*0.10 = 0.96
        options = [
            {"label": "X0", "multiplier": Decimal("0"), "prob": 0.40},
            {"label": "X1", "multiplier": Decimal("1"), "prob": 0.34},
            {"label": "X2", "multiplier": Decimal("2"), "prob": 0.16},
            {"label": "X3", "multiplier": Decimal("3"), "prob": 0.10},
        ]

        if not wallet.has_made_real_deposit:
            # Boost higher multipliers slightly for welcome bonus users.
            options = [
                {"label": "X0", "multiplier": Decimal("0"), "prob": 0.30},
                {"label": "X1", "multiplier": Decimal("1"), "prob": 0.34},
                {"label": "X2", "multiplier": Decimal("2"), "prob": 0.22},
                {"label": "X3", "multiplier": Decimal("3"), "prob": 0.14},
            ]

        rnd = random.random()
        cumulative = 0.0
        selected = options[-1]
        for opt in options:
            cumulative += opt["prob"]
            if rnd <= cumulative:
                selected = opt
                break

        multiplier = selected["multiplier"]
        win_amount = (stake * multiplier).quantize(Decimal("0.01")) if multiplier > 0 else Decimal("0")
        is_win = win_amount > 0

        with transaction.atomic():
            if not wallet.has_made_real_deposit:
                playable_bonus = wallet.bonus_balance
                playable_cash = wallet.balance
                if playable_bonus + playable_cash < stake:
                    return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)

                deduct_from_bonus = min(playable_bonus, stake)
                deduct_from_cash = stake - deduct_from_bonus

                if deduct_from_bonus > 0:
                    wallet.adjust_bonus_balance(-deduct_from_bonus)
                if deduct_from_cash > 0:
                    wallet.adjust_balance(-deduct_from_cash)
            else:
                if not wallet.can_afford(stake):
                    return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)
                wallet.adjust_balance(-stake)

            Transaction.objects.create(
                user=request.user,
                type=Transaction.Type.GAME_STAKE,
                amount=stake,
                status=Transaction.Status.SUCCESS,
                provider="internal",
                meta={"game": "PICKBOX", "choice": choice},
            )

            if is_win:
                wallet.adjust_balance(win_amount)
                Transaction.objects.create(
                    user=request.user,
                    type=Transaction.Type.GAME_WIN,
                    amount=win_amount,
                    status=Transaction.Status.SUCCESS,
                    provider="internal",
                    meta={"game": "PICKBOX", "choice": choice, "result": selected["label"]},
                )

            GameRound.objects.create(
                user=request.user,
                game_type=GameRound.GameType.PICKBOX,
                stake=stake,
                result_label=selected["label"],
                multiplier=float(multiplier),
                win_amount=win_amount,
                is_win=is_win,
                extra_data={"choice": choice},
            )

        wallet.refresh_from_db()
        if wallet.has_made_real_deposit:
            display_balance = wallet.balance
        else:
            display_balance = wallet.balance + wallet.bonus_balance

        resp = PickBoxResultSerializer(
            {
                "stake": stake,
                "choice": choice,
                "revealed_label": selected["label"],
                "multiplier": float(multiplier),
                "win_amount": win_amount,
                "balance": display_balance,
            }
        ).data

        return Response(resp, status=status.HTTP_200_OK)
class PredictPlayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        stake_raw = request.data.get("stake")
        prediction_raw = request.data.get("prediction")

        try:
            stake = Decimal(str(stake_raw))
        except Exception:
            return Response({"detail": "Invalid stake amount."}, status=status.HTTP_400_BAD_REQUEST)

        if stake <= 0:
            return Response({"detail": "Stake must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(prediction_raw, str):
            return Response({"detail": "Prediction is required."}, status=status.HTTP_400_BAD_REQUEST)

        prediction = prediction_raw.strip().lower()
        allowed = {"red", "black"}
        if prediction not in allowed:
            return Response(
                {"detail": "Prediction must be 'red' or 'black'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wallet: Wallet = request.user.wallet
        if not wallet.can_afford(stake):
            return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)

        if not wallet.has_made_real_deposit:
            # Welcome bonus boost: slightly higher chance to match the user's prediction.
            outcome = prediction if random.random() < 0.60 else ("black" if prediction == "red" else "red")
        else:
            outcome = random.choice(sorted(allowed))
        is_win = prediction == outcome

        # Ask profit engine for a suitable multiplier based on recent margin.
        margin_predict_short = get_margin_for_game(GameRound.GameType.PREDICT.value, window_minutes=10)
        base_multiplier = get_predict_multiplier_for_margin(margin_predict_short)
        multiplier = base_multiplier if is_win else Decimal("0")
        win_amount = (stake * multiplier).quantize(Decimal("0.01")) if is_win else Decimal("0")

        with transaction.atomic():
            if not wallet.has_made_real_deposit:
                playable_bonus = wallet.bonus_balance
                playable_cash = wallet.balance
                if playable_bonus + playable_cash < stake:
                    return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)

                deduct_from_bonus = min(playable_bonus, stake)
                deduct_from_cash = stake - deduct_from_bonus

                if deduct_from_bonus > 0:
                    wallet.adjust_bonus_balance(-deduct_from_bonus)
                if deduct_from_cash > 0:
                    wallet.adjust_balance(-deduct_from_cash)
            else:
                if not wallet.can_afford(stake):
                    return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)
                wallet.adjust_balance(-stake)
            Transaction.objects.create(
                user=request.user,
                type=Transaction.Type.GAME_STAKE,
                amount=stake,
                status=Transaction.Status.SUCCESS,
                provider="internal",
                meta={"game": "PREDICT", "prediction": prediction},
            )

            if is_win:
                wallet.adjust_balance(win_amount)
                Transaction.objects.create(
                    user=request.user,
                    type=Transaction.Type.GAME_WIN,
                    amount=win_amount,
                    status=Transaction.Status.SUCCESS,
                    provider="internal",
                    meta={"game": "PREDICT", "prediction": prediction, "outcome": outcome},
                )

            GameRound.objects.create(
                user=request.user,
                game_type=GameRound.GameType.PREDICT,
                stake=stake,
                result_label=outcome,
                multiplier=float(multiplier),
                win_amount=win_amount,
                is_win=is_win,
                extra_data={"prediction": prediction, "outcome": outcome},
            )

        wallet.refresh_from_db()
        if wallet.has_made_real_deposit:
            display_balance = wallet.balance
        else:
            display_balance = wallet.balance + wallet.bonus_balance

        resp = PredictResultSerializer(
            {
                "stake": stake,
                "prediction": prediction,
                "outcome": outcome,
                "is_win": is_win,
                "multiplier": float(multiplier),
                "win_amount": win_amount,
                "balance": display_balance,
            }
        ).data

        return Response(resp, status=status.HTTP_200_OK)


class GameHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        rounds = GameRound.objects.filter(user=request.user).order_by("-created_at")[:100]
        data = GameRoundSerializer(rounds, many=True).data
        return Response(data)
