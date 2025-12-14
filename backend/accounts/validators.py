from __future__ import annotations

from django.core.exceptions import ValidationError


def normalize_mpesa_number(value: str) -> str:
    """Normalize an M-Pesa number by stripping spaces and leading '+'.

    The stored value is kept as digits only while still enforcing the strict
    formats required by the platform (07XXXXXXXX or 2547XXXXXXXXXX).
    """

    if value is None:
        raise ValidationError("M-Pesa number is required.")

    raw = str(value).strip().replace(" ", "")
    if raw.startswith("+"):
        raw = raw[1:]

    if not raw.isdigit():
        raise ValidationError("M-Pesa number must contain digits only.")

    return raw


def validate_mpesa_number(value: str) -> None:
    digits = normalize_mpesa_number(value)

    if (len(digits) == 10 and digits.startswith("07")) or (
        len(digits) == 12 and digits.startswith("2547")
    ):
        return

    raise ValidationError(
        "M-Pesa number must be 10 digits starting with 07 or 12 digits starting with 2547."
    )
