from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    ChangePasswordView,
    ForgotPasswordView,
    MeView,
    MyReferralsView,
    PasswordResetProcessView,
    PasswordResetRequestListView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", TokenObtainPairView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("my-referrals/", MyReferralsView.as_view(), name="auth-my-referrals"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("admin/password-resets/", PasswordResetRequestListView.as_view(), name="auth-password-reset-list"),
    path(
        "admin/password-resets/<int:pk>/reset/",
        PasswordResetProcessView.as_view(),
        name="auth-password-reset-process",
    ),
]
