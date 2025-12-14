from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from .validators import validate_mpesa_number, normalize_mpesa_number


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(
        self,
        email: str,
        mpesa_number: str,
        password: str | None,
        **extra_fields: object,
    ) -> "User":
        if not email:
            raise ValueError("The Email field must be set.")
        # Normalise email to lowercase so login is case-insensitive system-wide.
        email = self.normalize_email(email).lower()

        if not mpesa_number:
            raise ValueError("The M-Pesa number must be set.")
        normalized_mpesa = normalize_mpesa_number(mpesa_number)

        user = self.model(
            email=email,
            mpesa_number=normalized_mpesa,
            **extra_fields,
        )
        if password:
            user.set_password(password)
        else:
            raise ValueError("Password must be provided.")

        user.full_clean()
        user.save(using=self._db)
        return user

    def create_user(
        self,
        email: str,
        mpesa_number: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, mpesa_number, password, **extra_fields)

    def create_superuser(
        self,
        email: str,
        mpesa_number: str,
        password: str | None,
        **extra_fields: object,
    ) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, mpesa_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    mpesa_number = models.CharField(
        max_length=20,
        unique=True,
        validators=[validate_mpesa_number],
        help_text=(
            "M-Pesa number must be 10 digits starting with 07 or 12 digits starting with 2547."
        ),
    )
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    referral_code = models.CharField(max_length=20, blank=True)
    referrer = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="referrals",
        null=True,
        blank=True,
    )
    force_password_change = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["mpesa_number"]

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return self.email

    def save(self, *args, **kwargs):  # pragma: no cover - simple behaviour
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.referral_code:
            self.referral_code = f"BY{self.pk:06d}"
            super().save(update_fields=["referral_code"])


class PasswordResetRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        DONE = "DONE", "Done"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_resets")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
