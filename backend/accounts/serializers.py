from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .validators import validate_mpesa_number, normalize_mpesa_number

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "mpesa_number",
            "date_joined",
            "is_staff",
            "is_superuser",
            "referral_code",
            "force_password_change",
        )
        read_only_fields = fields


class AdminUserSerializer(serializers.ModelSerializer):
    total_deposits = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_withdrawals = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "mpesa_number",
            "date_joined",
            "is_staff",
            "is_superuser",
            "referral_code",
            "force_password_change",
            "total_deposits",
            "total_withdrawals",
        )
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("email", "mpesa_number", "password", "referral_code")

    def validate_mpesa_number(self, value: str) -> str:
        validate_mpesa_number(value)
        return normalize_mpesa_number(value)

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password")
        mpesa_number = validated_data.pop("mpesa_number")
        referral_code = validated_data.pop("referral_code", "").strip() or None

        referrer = None
        if referral_code:
            try:
                referrer = User.objects.get(referral_code=referral_code)
            except User.DoesNotExist:
                referrer = None

        user = User.objects.create_user(
            mpesa_number=mpesa_number,
            password=password,
            referrer=referrer,
            **validated_data,
        )
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=8)

    class Meta:
        model = User
        fields = ("email", "mpesa_number", "password")
        extra_kwargs = {
            "email": {"required": False},
            "mpesa_number": {"required": False},
        }

    def validate_mpesa_number(self, value: str) -> str:
        validate_mpesa_number(value)
        return normalize_mpesa_number(value)

    def update(self, instance: User, validated_data: dict) -> User:
        password = validated_data.pop("password", None)
        changed_fields: list[str] = []

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            changed_fields.append(attr)

        if password is not None:
            instance.set_password(password)
            changed_fields.append("password")

        instance.full_clean()
        instance.save(update_fields=changed_fields or None)
        return instance


class PasswordResetRequestSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    processed_at = serializers.DateTimeField(read_only=True)
    user = UserSerializer(read_only=True)
