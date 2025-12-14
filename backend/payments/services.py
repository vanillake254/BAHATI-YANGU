from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from django.conf import settings
import requests


@dataclass
class IntaSendConfig:
    public_key: str
    secret_key: str
    test: bool

    @classmethod
    def from_settings(cls) -> "IntaSendConfig":
        env = str(getattr(settings, "INTASEND_ENV", "") or "").strip().lower()
        return cls(
            public_key=settings.INTASEND_PUBLIC_KEY,
            secret_key=settings.INTASEND_SECRET_KEY,
            test=env not in {"live", "production", "prod"},
        )


class IntaSendClient:
    """Minimal IntaSend HTTP client for Checkout Links and payouts.

    This uses raw HTTP calls instead of the full SDK to keep the
    dependency surface small. Endpoints are based on IntaSend's public
    API documentation.
    """

    def __init__(self, config: IntaSendConfig | None = None) -> None:
        self.config = config or IntaSendConfig.from_settings()
        # IntaSend has multiple domains in the wild:
        # - API endpoints documented under api.intasend.com
        # - Hosted checkout pages under payment.intasend.com
        # IntaSend SDK uses payment.intasend.com for ALL authenticated API calls
        self.api_base_url = "https://sandbox.intasend.com/api/v1" if self.config.test else "https://payment.intasend.com/api/v1"
        self.checkout_base_url = "https://sandbox.intasend.com/api/v1" if self.config.test else "https://payment.intasend.com/api/v1"

    def _raise_for_status(self, resp: requests.Response) -> None:
        if resp.ok:
            return
        details: str
        try:
            details = resp.text
        except Exception:
            details = ""
        method = getattr(getattr(resp, "request", None), "method", "")
        url = getattr(resp, "url", "")
        raise requests.HTTPError(
            f"IntaSend HTTP {resp.status_code} {method} {url}: {details}",
            response=resp,
        )

    def _headers(self) -> Dict[str, str]:
        # IntaSend SDK requires BOTH Authorization AND INTASEND_PUBLIC_API_KEY headers
        return {
            "Authorization": f"Bearer {self.config.secret_key}",
            "Content-Type": "application/json",
            "INTASEND_PUBLIC_API_KEY": self.config.public_key,
        }

    def _noauth_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "INTASEND_PUBLIC_API_KEY": self.config.public_key,
        }

    def _checkout_headers(self) -> Dict[str, str]:
        # Confirmed in production: /api/v1/checkout/ works without Authorization.
        # Passing Bearer (public or secret) returns 401 "Session expired".
        return {"Content-Type": "application/json"}

    def _normalize_msisdn(self, mpesa_number: str) -> str:
        raw = str(mpesa_number).strip().replace(" ", "")
        if raw.startswith("+"):
            raw = raw[1:]
        # Convert 07XXXXXXXX to 2547XXXXXXXX
        if len(raw) == 10 and raw.startswith("07"):
            return "254" + raw[1:]
        return raw

    def create_checkout_link(
        self,
        amount: float,
        email: str,
        mpesa_number: str,
        callback_url: str,
        host: str,
        redirect_url: str,
        api_ref: str,
    ) -> Dict[str, Any]:
        """Create a Checkout Link payment.

        Returns the response JSON which should contain a checkout or
        invoice URL the frontend can redirect to.
        """

        payload = {
            "amount": amount,
            "currency": "KES",
            "email": email,
            "phone_number": self._normalize_msisdn(mpesa_number),
            "callback_url": callback_url,
            "host": host,
            "redirect_url": redirect_url,
            "api_ref": api_ref,
            "public_key": self.config.public_key,
        }

        url = f"{self.checkout_base_url}/checkout/"
        resp = requests.post(url, json=payload, headers=self._checkout_headers(), timeout=30)
        self._raise_for_status(resp)
        return resp.json()

    def mpesa_stk_push(
        self,
        amount: float,
        email: str,
        mpesa_number: str,
        api_ref: str,
        host: str,
        callback_url: str,
        narrative: str = "Bahati Yangu deposit",
        first_name: str = "",
        last_name: str = "",
    ) -> Dict[str, Any]:
        payload = {
            "amount": amount,
            "currency": "KES",
            "email": email,
            "phone_number": self._normalize_msisdn(mpesa_number),
            "api_ref": api_ref,
            "host": host,
            "narrative": narrative,
            "first_name": first_name,
            "last_name": last_name,
            "callback_url": callback_url,
        }

        url = f"{self.api_base_url}/payment/mpesa-stk-push/"
        resp = requests.post(url, json=payload, headers=self._headers(), timeout=30)
        self._raise_for_status(resp)
        return resp.json()

    def payment_status(self, invoice_id: str) -> Dict[str, Any]:
        payload = {
            "invoice_id": str(invoice_id),
            "public_key": self.config.public_key,
        }

        url = f"{self.api_base_url}/payment/status/"
        resp = requests.post(url, json=payload, headers=self._noauth_headers(), timeout=30)
        self._raise_for_status(resp)
        return resp.json()

    def initiate_payout(
        self,
        amount: float,
        mpesa_number: str,
        narrative: str,
        callback_url: str,
        request_reference_id: str = "",
    ) -> Dict[str, Any]:
        # IntaSend Send Money API - matching official SDK payload exactly
        payload = {
            "provider": "MPESA-B2C",
            "currency": "KES",
            "callback_url": callback_url,
            "requires_approval": "NO",  # Skip device approval
            "wallet_id": None,
            "transactions": [
                {
                    "name": "Bahati Yangu Player",
                    "account": int(self._normalize_msisdn(mpesa_number)),
                    "amount": int(round(amount)),
                    "narrative": narrative,
                    "request_reference_id": str(request_reference_id or ""),
                }
            ],
        }

        url = f"{self.api_base_url}/send-money/initiate/"
        resp = requests.post(url, json=payload, headers=self._headers(), timeout=30)
        self._raise_for_status(resp)
        return resp.json()

    def payout_status(self, tracking_id: str) -> Dict[str, Any]:
        payload = {
            "tracking_id": str(tracking_id),
        }

        url = f"{self.api_base_url}/send-money/status/"
        resp = requests.post(url, json=payload, headers=self._headers(), timeout=30)
        self._raise_for_status(resp)
        return resp.json()
