from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import logging
import requests
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from transactions.models import Transaction
from wallet.models import Wallet

from .services import IntaSendClient

logger = logging.getLogger(__name__)


class DepositInitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        amount_raw = request.data.get("amount")
        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"detail": "Amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        if amount < Decimal("50"):
            return Response({"detail": "Minimum deposit is KES 50."}, status=status.HTTP_400_BAD_REQUEST)

        tx = Transaction.objects.create(
            user=request.user,
            type=Transaction.Type.DEPOSIT,
            amount=amount,
            status=Transaction.Status.PENDING,
            provider="intasend",
        )

        callback_url = request.build_absolute_uri("/api/payments/webhook/")
        host = settings.FRONTEND_BASE_URL
        api_ref = f"deposit-{tx.id}"

        client = IntaSendClient()
        try:
            api_resp = client.mpesa_stk_push(
                amount=float(amount),
                email=request.user.email,
                mpesa_number=request.user.mpesa_number,
                api_ref=api_ref,
                host=host,
                callback_url=callback_url,
            )
        except requests.RequestException as exc:
            logger.exception("IntaSend deposit init failed")
            tx.status = Transaction.Status.FAILED
            tx.meta = {"error": str(exc)}
            tx.save(update_fields=["status", "meta"])

            payload = {"detail": "Payment provider error. Please try again.", "provider": "intasend"}
            if getattr(request.user, "is_staff", False):
                payload["provider_error"] = str(exc)
            return Response(
                payload,
                status=status.HTTP_502_BAD_GATEWAY,
            )

        tx.reference_id = str(api_resp.get("invoice_id") or api_resp.get("id") or api_resp.get("tracking_id") or "")
        # Persist api_ref for reliable webhook correlation (some STK webhooks return different identifiers)
        tx.meta = {"api_ref": api_ref, **(api_resp or {})}
        tx.save(update_fields=["reference_id", "meta"])

        return Response(
            {
                "transaction_id": tx.id,
                "status": "PENDING",
            },
            status=status.HTTP_201_CREATED,
        )


class WithdrawInitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        amount_raw = request.data.get("amount")
        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"detail": "Amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        if amount < Decimal("100"):
            return Response({"detail": "Minimum withdrawal is KES 100."}, status=status.HTTP_400_BAD_REQUEST)

        if amount % Decimal("50") != 0:
            return Response(
                {"detail": "Withdrawal amount must be in increments of KES 50 (100, 150, 200, ...)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wallet: Wallet = request.user.wallet
        if not wallet.has_made_real_deposit:
            return Response(
                {"detail": "You must make a real deposit before you can withdraw."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        last_success_deposit = (
            Transaction.objects.filter(
                user=request.user,
                type=Transaction.Type.DEPOSIT,
                status=Transaction.Status.SUCCESS,
            )
            .order_by("-created_at")
            .first()
        )

        if last_success_deposit:
            plays_since_deposit = Transaction.objects.filter(
                user=request.user,
                type=Transaction.Type.GAME_STAKE,
                created_at__gt=last_success_deposit.created_at,
            ).count()
            if plays_since_deposit < 2:
                return Response(
                    {"detail": "After depositing, you must play at least 2 times before you can withdraw."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not wallet.can_afford(amount):
            return Response({"detail": "Insufficient wallet balance."}, status=status.HTTP_400_BAD_REQUEST)

        tx = Transaction.objects.create(
            user=request.user,
            type=Transaction.Type.WITHDRAWAL,
            amount=amount,
            status=Transaction.Status.PENDING,
            provider="intasend",
        )

        # Optimistically lock funds by deducting from wallet; they will be
        # returned on FAILURE webhook if needed.
        wallet.adjust_balance(-amount)

        callback_url = request.build_absolute_uri("/api/payouts/webhook/")

        client = IntaSendClient()
        try:
            api_resp = client.initiate_payout(
                amount=float(amount),
                mpesa_number=request.user.mpesa_number,
                narrative="Bahati Yangu cashout",
                callback_url=callback_url,
            )
        except requests.RequestException as exc:
            logger.exception("IntaSend payout init failed")
            wallet.adjust_balance(amount)
            tx.status = Transaction.Status.FAILED
            tx.meta = {"error": str(exc)}
            tx.save(update_fields=["status", "meta"])

            payload = {"detail": "Payout provider error. Please try again.", "provider": "intasend"}
            if getattr(request.user, "is_staff", False):
                payload["provider_error"] = str(exc)
            return Response(
                payload,
                status=status.HTTP_502_BAD_GATEWAY,
            )

        tx.reference_id = str(api_resp.get("batch_id") or api_resp.get("id") or "")
        tx.meta = api_resp
        tx.save(update_fields=["reference_id", "meta"])

        return Response(
            {
                "status": "PENDING",
                "transaction_id": tx.id,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name="dispatch")
class PaymentWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        payload = request.data
        reference = str(payload.get("invoice_id") or payload.get("id") or payload.get("tracking_id") or "")
        api_ref = str(payload.get("api_ref") or payload.get("account_reference") or payload.get("merchant_reference") or "")
        status_str = str(payload.get("state") or payload.get("status") or "").upper()

        try:
            if reference:
                tx = Transaction.objects.get(reference_id=reference, type=Transaction.Type.DEPOSIT)
            else:
                raise Transaction.DoesNotExist
        except Transaction.DoesNotExist:
            # Fallback: locate tx by api_ref pattern: deposit-<tx_id>
            tx = None
            if api_ref.startswith("deposit-"):
                try:
                    tx_id = int(api_ref.split("deposit-", 1)[1])
                    tx = Transaction.objects.get(id=tx_id, type=Transaction.Type.DEPOSIT)
                except Exception:
                    tx = None
            if tx is None:
                try:
                    tx = Transaction.objects.get(type=Transaction.Type.DEPOSIT, meta__api_ref=api_ref)
                except Exception:
                    return Response({"detail": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        if tx.status == Transaction.Status.SUCCESS:
            return Response({"detail": "Already processed."})

        if status_str in {"COMPLETE", "SUCCESS", "SUCCEEDED"}:
            wallet = tx.user.wallet
            was_first = not wallet.has_made_real_deposit

            wallet.adjust_balance(tx.amount)
            if was_first:
                wallet.bonus_balance = Decimal("0")
                wallet.has_made_real_deposit = True
                wallet.save(update_fields=["bonus_balance", "has_made_real_deposit", "balance"])
            else:
                wallet.save(update_fields=["balance"])

            # Award referral bonus (10% of first deposit) to referrer, playable but
            # only withdrawable once they have made a real deposit themselves.
            if tx.user.referrer:
                deposit_count = Transaction.objects.filter(
                    user=tx.user,
                    type=Transaction.Type.DEPOSIT,
                    status=Transaction.Status.SUCCESS,
                ).count()

                # Reward only on the first 3 successful deposits.
                if deposit_count <= 3:
                    already_rewarded = Transaction.objects.filter(
                        user=tx.user.referrer,
                        type=Transaction.Type.REFERRAL_BONUS,
                        provider="internal",
                        meta__source_tx=tx.id,
                    ).exists()

                    if not already_rewarded:
                        referrer_wallet: Wallet = tx.user.referrer.wallet
                        reward = (tx.amount * Decimal("0.10")).quantize(Decimal("0.01"))
                        if reward > 0:
                            referrer_wallet.adjust_balance(reward)
                            Transaction.objects.create(
                                user=tx.user.referrer,
                                type=Transaction.Type.REFERRAL_BONUS,
                                amount=reward,
                                status=Transaction.Status.SUCCESS,
                                provider="internal",
                                meta={
                                    "referred_user_id": tx.user.id,
                                    "source_tx": tx.id,
                                    "deposit_number": deposit_count,
                                },
                            )

            tx.status = Transaction.Status.SUCCESS
            tx.meta = {**(tx.meta or {}), "webhook": payload}
            tx.save(update_fields=["status", "meta"])
        elif status_str in {"CANCELED", "CANCELLED"}:
            tx.status = Transaction.Status.FAILED
            tx.meta = {**(tx.meta or {}), "webhook": payload, "final_state": "CANCELED"}
            tx.save(update_fields=["status", "meta"])
        elif status_str in {"FAILED"}:
            tx.status = Transaction.Status.FAILED
            tx.meta = {**(tx.meta or {}), "webhook": payload, "final_state": "FAILED"}
            tx.save(update_fields=["status", "meta"])

        return Response({"detail": "ok"})


class PaymentStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, tx_id: int, *args, **kwargs):
        try:
            tx = Transaction.objects.get(id=tx_id, user=request.user, provider="intasend")
        except Transaction.DoesNotExist:
            return Response({"detail": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        final_state = str(tx.meta.get("final_state") or "").upper() if isinstance(tx.meta, dict) else ""

        return Response(
            {
                "id": tx.id,
                "type": tx.type,
                "amount": str(tx.amount),
                "status": tx.status,
                "final_state": final_state,
                "reference_id": tx.reference_id,
            }
        )


@method_decorator(csrf_exempt, name="dispatch")
class PayoutWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        payload = request.data
        reference = str(payload.get("batch_id") or payload.get("id") or "")
        status_str = str(payload.get("state") or payload.get("status") or "").upper()

        try:
            tx = Transaction.objects.get(reference_id=reference, type=Transaction.Type.WITHDRAWAL)
        except Transaction.DoesNotExist:
            return Response({"detail": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        if tx.status == Transaction.Status.SUCCESS:
            return Response({"detail": "Already processed."})

        wallet = tx.user.wallet

        if status_str in {"COMPLETE", "SUCCESS", "SUCCEEDED"}:
            tx.status = Transaction.Status.SUCCESS
            tx.meta = {**tx.meta, "webhook": payload}
            tx.save(update_fields=["status", "meta"])
        elif status_str in {"CANCELED", "CANCELLED"}:
            wallet.adjust_balance(tx.amount)
            tx.status = Transaction.Status.FAILED
            tx.meta = {**tx.meta, "webhook": payload, "final_state": "CANCELED"}
            tx.save(update_fields=["status", "meta"])
        elif status_str in {"FAILED"}:
            # Return funds to wallet if payout failed
            wallet.adjust_balance(tx.amount)
            tx.status = Transaction.Status.FAILED
            tx.meta = {**tx.meta, "webhook": payload, "final_state": "FAILED"}
            tx.save(update_fields=["status", "meta"])

        return Response({"detail": "ok"})
