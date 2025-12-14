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


def _first_dict(value):
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return value[0]
    return None


def _status_upper(payload) -> str:
    if not isinstance(payload, dict):
        logger.warning(f"_status_upper: payload is not dict: {type(payload)}")
        return ""

    # Try direct state/status fields
    direct = str(payload.get("state") or payload.get("status") or "").upper()
    if direct:
        logger.info(f"_status_upper: found direct status = {direct}")
        return direct

    # Try nested in transactions[0]
    first_tx = _first_dict(payload.get("transactions"))
    if first_tx:
        nested = str(first_tx.get("state") or first_tx.get("status") or first_tx.get("state_code") or "").upper()
        if nested:
            logger.info(f"_status_upper: found nested tx status = {nested}")
            return nested

    # Try nested in invoice
    invoice = payload.get("invoice")
    if isinstance(invoice, dict):
        inv = str(invoice.get("state") or invoice.get("status") or "").upper()
        if inv:
            logger.info(f"_status_upper: found invoice status = {inv}")
            return inv

    # Log the full payload for debugging
    logger.warning(f"_status_upper: could not find status in payload keys: {list(payload.keys())}")
    return ""


def _finalize_deposit_from_payload(tx: Transaction, payload: dict) -> None:
    status_str = _status_upper(payload)

    if status_str in {"COMPLETE", "COMPLETED", "SUCCESS", "SUCCEEDED", "SUCCESSFUL"}:
        wallet = tx.user.wallet
        was_first = not wallet.has_made_real_deposit

        wallet.adjust_balance(tx.amount)
        if was_first:
            wallet.bonus_balance = Decimal("0")
            wallet.has_made_real_deposit = True
            wallet.save(update_fields=["bonus_balance", "has_made_real_deposit", "balance"])
        else:
            wallet.save(update_fields=["balance"])

        if tx.user.referrer:
            deposit_count = Transaction.objects.filter(
                user=tx.user,
                type=Transaction.Type.DEPOSIT,
                status=Transaction.Status.SUCCESS,
            ).count()

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
        tx.meta = {**(tx.meta or {}), "provider_status": payload}
        tx.save(update_fields=["status", "meta"])
        return

    if status_str in {"CANCELED", "CANCELLED"}:
        tx.status = Transaction.Status.FAILED
        tx.meta = {**(tx.meta or {}), "provider_status": payload, "final_state": "CANCELED"}
        tx.save(update_fields=["status", "meta"])
        return

    if status_str in {"FAILED"}:
        tx.status = Transaction.Status.FAILED
        tx.meta = {**(tx.meta or {}), "provider_status": payload, "final_state": "FAILED"}
        tx.save(update_fields=["status", "meta"])


def _finalize_withdrawal_from_payload(tx: Transaction, payload: dict) -> None:
    status_str = _status_upper(payload)

    if status_str in {"COMPLETE", "COMPLETED", "SUCCESS", "SUCCEEDED", "SUCCESSFUL"}:
        tx.status = Transaction.Status.SUCCESS
        tx.meta = {**(tx.meta or {}), "provider_status": payload}
        tx.save(update_fields=["status", "meta"])
        return

    wallet = tx.user.wallet

    if status_str in {"CANCELED", "CANCELLED"}:
        wallet.adjust_balance(tx.amount)
        tx.status = Transaction.Status.FAILED
        tx.meta = {**(tx.meta or {}), "provider_status": payload, "final_state": "CANCELED"}
        tx.save(update_fields=["status", "meta"])
        return

    if status_str in {"FAILED"}:
        wallet.adjust_balance(tx.amount)
        tx.status = Transaction.Status.FAILED
        tx.meta = {**(tx.meta or {}), "provider_status": payload, "final_state": "FAILED"}
        tx.save(update_fields=["status", "meta"])


def _find_tx_by_refs(*, tx_type: str, refs: list[str], meta_keys: list[str]):
    refs_clean = [str(r) for r in refs if r]
    for ref in refs_clean:
        try:
            return Transaction.objects.get(reference_id=ref, type=tx_type)
        except Transaction.DoesNotExist:
            pass

    for ref in refs_clean:
        for k in meta_keys:
            try:
                return Transaction.objects.get(type=tx_type, meta__contains={k: ref})
            except Transaction.DoesNotExist:
                continue

    return None


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

        # IntaSend STK push returns nested structure: {"invoice": {"invoice_id": "..."}}
        invoice = api_resp.get("invoice") if isinstance(api_resp, dict) else None
        if isinstance(invoice, dict):
            ref_id = str(invoice.get("invoice_id") or invoice.get("id") or "")
        else:
            ref_id = str(api_resp.get("invoice_id") or api_resp.get("id") or api_resp.get("tracking_id") or "")
        
        tx.reference_id = ref_id or api_ref  # Fallback to api_ref if no invoice_id
        logger.info(f"Deposit tx {tx.id}: stored reference_id={tx.reference_id}, api_resp keys={list(api_resp.keys()) if api_resp else None}")
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
                request_reference_id=f"withdraw-{tx.id}",
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

        tracking_id = str(api_resp.get("tracking_id") or "")
        first_tx = _first_dict(api_resp.get("transactions"))
        request_reference_id = str((first_tx or {}).get("request_reference_id") or f"withdraw-{tx.id}")
        tx.reference_id = tracking_id or str(api_resp.get("batch_id") or api_resp.get("id") or request_reference_id or "")
        logger.info(f"Withdrawal tx {tx.id}: stored reference_id={tx.reference_id}, tracking_id={tracking_id}, api_resp keys={list(api_resp.keys()) if api_resp else None}")
        tx.meta = {**(api_resp or {}), "tracking_id": tracking_id, "request_reference_id": request_reference_id}
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
        logger.info(f"PaymentWebhook received: {dict(payload) if hasattr(payload, 'keys') else payload}")
        
        # Handle IntaSend challenge validation
        challenge = payload.get("challenge") if isinstance(payload, dict) else None
        if challenge:
            logger.info(f"PaymentWebhook: responding to challenge")
            return Response({"challenge": challenge})
        
        # Extract from IntaSend's documented collection webhook format
        invoice_id = str(payload.get("invoice_id") or "")
        api_ref = str(payload.get("api_ref") or "")
        status_str = str(payload.get("state") or payload.get("status") or "").upper()
        reference = invoice_id or api_ref
        
        logger.info(f"PaymentWebhook: invoice_id={invoice_id}, api_ref={api_ref}, status={status_str}")

        tx = _find_tx_by_refs(
            tx_type=Transaction.Type.DEPOSIT,
            refs=[reference, api_ref],
            meta_keys=["api_ref", "tracking_id", "invoice_id", "id"],
        )

        if tx is None and api_ref.startswith("deposit-"):
            try:
                tx_id = int(api_ref.split("deposit-", 1)[1])
                tx = Transaction.objects.filter(id=tx_id, type=Transaction.Type.DEPOSIT).first()
                logger.info(f"PaymentWebhook: found tx by api_ref pattern: tx_id={tx_id}, tx={tx}")
            except Exception as e:
                logger.warning(f"PaymentWebhook: failed to parse api_ref {api_ref}: {e}")
                tx = None

        if tx is None:
            logger.warning(f"PaymentWebhook: no matching transaction found for reference={reference}, api_ref={api_ref}")
            return Response({"detail": "ok"})

        if tx.status == Transaction.Status.SUCCESS:
            return Response({"detail": "Already processed."})

        if status_str in {"COMPLETE", "COMPLETED", "SUCCESS", "SUCCEEDED", "SUCCESSFUL"}:
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

        # Try to get status from IntaSend with short timeout (5s) if still pending
        if tx.status == Transaction.Status.PENDING:
            meta = tx.meta if isinstance(tx.meta, dict) else {}
            client = IntaSendClient()
            
            try:
                if tx.type == Transaction.Type.DEPOSIT:
                    # For deposits, use invoice_id from nested structure or api_ref
                    invoice = meta.get("invoice") if isinstance(meta.get("invoice"), dict) else {}
                    invoice_id = str(invoice.get("invoice_id") or meta.get("invoice_id") or "")
                    
                    if invoice_id:
                        logger.info(f"Checking deposit status for tx {tx.id}, invoice_id={invoice_id}")
                        resp = requests.post(
                            f"{client.api_base_url}/payment/status/",
                            json={"invoice_id": invoice_id, "public_key": client.config.public_key},
                            headers=client._noauth_headers(),
                            timeout=5,
                        )
                        if resp.ok:
                            provider_payload = resp.json()
                            logger.info(f"IntaSend deposit status: {provider_payload}")
                            _finalize_deposit_from_payload(tx, provider_payload)
                            tx.refresh_from_db()
                            
                elif tx.type == Transaction.Type.WITHDRAWAL:
                    tracking_id = str(meta.get("tracking_id") or "")
                    
                    if tracking_id:
                        logger.info(f"Checking withdrawal status for tx {tx.id}, tracking_id={tracking_id}")
                        resp = requests.post(
                            f"{client.api_base_url}/send-money/status/",
                            json={"tracking_id": tracking_id},
                            headers=client._headers(),
                            timeout=5,
                        )
                        if resp.ok:
                            provider_payload = resp.json()
                            logger.info(f"IntaSend payout status: {provider_payload}")
                            _finalize_withdrawal_from_payload(tx, provider_payload)
                            tx.refresh_from_db()
            except Exception as e:
                logger.warning(f"IntaSend status check failed for tx {tx.id}: {e}")

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
        logger.info(f"PayoutWebhook received: {dict(payload) if hasattr(payload, 'keys') else payload}")
        
        # Handle IntaSend challenge validation (they send empty or challenge-only payloads)
        challenge = payload.get("challenge") if isinstance(payload, dict) else None
        if challenge:
            logger.info(f"PayoutWebhook: responding to challenge")
            return Response({"challenge": challenge})
        
        # Extract identifiers from IntaSend's documented webhook format
        first_tx = _first_dict(payload.get("transactions"))
        request_reference_id = str((first_tx or {}).get("request_reference_id") or payload.get("request_reference_id") or "")
        tracking_id = str(payload.get("tracking_id") or "")
        file_id = str(payload.get("file_id") or "")
        reference = tracking_id or file_id or request_reference_id
        
        # Get status from top level or transaction level
        status_str = str(payload.get("status") or payload.get("state") or "").upper()
        tx_status = str((first_tx or {}).get("status") or "").upper()
        if tx_status in {"SUCCESSFUL", "SUCCESS"}:
            status_str = "SUCCESS"
        elif tx_status == "FAILED":
            status_str = "FAILED"
        
        logger.info(f"PayoutWebhook: tracking_id={tracking_id}, file_id={file_id}, request_reference_id={request_reference_id}, status={status_str}")

        tx = _find_tx_by_refs(
            tx_type=Transaction.Type.WITHDRAWAL,
            refs=[tracking_id, file_id, request_reference_id],
            meta_keys=["tracking_id", "file_id", "request_reference_id", "id", "batch_id"],
        )

        # Fallback: find by withdraw-{tx_id} pattern in request_reference_id
        if tx is None and request_reference_id.startswith("withdraw-"):
            try:
                tx_id = int(request_reference_id.split("withdraw-", 1)[1])
                tx = Transaction.objects.filter(id=tx_id, type=Transaction.Type.WITHDRAWAL).first()
                logger.info(f"PayoutWebhook: found tx by pattern: tx_id={tx_id}")
            except Exception as e:
                logger.warning(f"PayoutWebhook: failed to parse request_reference_id: {e}")

        if tx is None:
            logger.warning(f"PayoutWebhook: no matching tx for tracking_id={tracking_id}, request_reference_id={request_reference_id}")
            return Response({"detail": "ok"})

        if tx.status == Transaction.Status.SUCCESS:
            return Response({"detail": "Already processed."})

        wallet = tx.user.wallet

        if status_str in {"COMPLETE", "COMPLETED", "SUCCESS", "SUCCEEDED", "SUCCESSFUL"}:
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
