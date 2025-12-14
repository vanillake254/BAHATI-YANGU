from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from django.db.models import Q, Sum
import secrets
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from transactions.models import Transaction
from wallet.models import Wallet

from .serializers import (
    AdminUserSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .models import PasswordResetRequest

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user: User = serializer.save()

        # Ensure wallet exists for this user.
        wallet: Wallet = user.wallet
        # Grant signup bonus of 100 KES into bonus_balance for gameplay before first deposit.
        wallet.adjust_bonus_balance(Decimal("100"))
        Transaction.objects.create(
            user=user,
            type=Transaction.Type.BONUS_CREDIT,
            amount=Decimal("100"),
            status=Transaction.Status.SUCCESS,
            provider="internal",
            meta={"reason": "signup_bonus"},
        )

        refresh = RefreshToken.for_user(user)
        data = {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return Response(data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        serializer = ProfileUpdateSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        email = str(request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "No account found with this email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if there's already a pending request
        existing = PasswordResetRequest.objects.filter(
            user=user, status=PasswordResetRequest.Status.PENDING
        ).first()
        if existing:
            return Response(
                {"detail": "A password reset request is already pending for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        PasswordResetRequest.objects.create(user=user, status=PasswordResetRequest.Status.PENDING)
        return Response(
            {"detail": "Password reset request submitted. Your password will be reset to 00000000 within 24 hours."},
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        current_password = request.data.get("current_password") or ""
        new_password = request.data.get("new_password") or ""

        if not current_password or not new_password:
            return Response(
                {"detail": "Current and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user: User = request.user
        if not user.check_password(current_password):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.force_password_change = False
        user.save(update_fields=["password", "force_password_change"])
        return Response({"detail": "Password updated successfully."})


class PasswordResetRequestListView(generics.ListAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):  # type: ignore[override]
        qs = PasswordResetRequest.objects.select_related("user").order_by("-created_at")
        status_param = str(self.request.query_params.get("status") or "").strip().upper()
        if status_param in {PasswordResetRequest.Status.PENDING, PasswordResetRequest.Status.DONE}:
            qs = qs.filter(status=status_param)
        return qs


class PasswordResetProcessView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk: int, *args, **kwargs):
        try:
            pr = PasswordResetRequest.objects.get(pk=pk)
        except PasswordResetRequest.DoesNotExist:
            return Response({"detail": "Reset request not found."}, status=status.HTTP_404_NOT_FOUND)

        user = pr.user
        temp_password = "00000000"
        user.set_password(temp_password)
        user.force_password_change = True
        user.save(update_fields=["password", "force_password_change"])

        pr.status = PasswordResetRequest.Status.DONE
        pr.processed_at = timezone.now()
        pr.save(update_fields=["status", "processed_at"])

        return Response(
            {
                "detail": "Password reset to 00000000 successfully.",
                "temporary_password": temp_password,
                "force_password_change": True,
            }
        )


class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):  # type: ignore[override]
        return (
            User.objects.all()
            .annotate(
                total_deposits=Sum(
                    "transactions__amount",
                    filter=Q(
                        transactions__type=Transaction.Type.DEPOSIT,
                        transactions__status=Transaction.Status.SUCCESS,
                    ),
                ),
                total_withdrawals=Sum(
                    "transactions__amount",
                    filter=Q(
                        transactions__type=Transaction.Type.WITHDRAWAL,
                        transactions__status=Transaction.Status.SUCCESS,
                    ),
                ),
            )
            .order_by("-date_joined")
        )


class AdminResetUserPasswordView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, user_id: int, *args, **kwargs):
        try:
            user: User = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Reset password to default 00000000 and force user to change it on next login.
        temp_password = "00000000"
        user.set_password(temp_password)
        user.force_password_change = True
        user.save(update_fields=["password", "force_password_change"])

        return Response(
            {
                "detail": "Password reset to 00000000 successfully.",
                "temporary_password": temp_password,
                "force_password_change": True,
            }
        )


class MyReferralsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = User.objects.filter(referrer=request.user).order_by("-date_joined")
        data = [
            {
                "mpesa_number": u.mpesa_number,
                "date_joined": u.date_joined,
            }
            for u in qs
        ]
        return Response(data)
