from django.contrib import admin
from django.urls import include, path

from payments.views import PaymentWebhookView, PayoutWebhookView
from accounts.views import AdminResetUserPasswordView, AdminUserListView
from transactions.views import AdminDepositListView, AdminWithdrawalListView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/wallet/", include("wallet.urls")),
    path("api/transactions/", include("transactions.urls")),
    path("api/games/", include("games.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/payments/webhook/", PaymentWebhookView.as_view(), name="payments-webhook"),
    path("api/payments/webhook", PaymentWebhookView.as_view(), name="payments-webhook-noslash"),
    path("api/payouts/webhook/", PayoutWebhookView.as_view(), name="payouts-webhook"),
    path("api/payouts/webhook", PayoutWebhookView.as_view(), name="payouts-webhook-noslash"),
    path("api/profit/", include("profit_engine.urls")),
    path("api/admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path(
        "api/admin/users/<int:user_id>/reset-password/",
        AdminResetUserPasswordView.as_view(),
        name="admin-user-reset-password",
    ),
    path("api/admin/deposits/", AdminDepositListView.as_view(), name="admin-deposits"),
    path("api/admin/withdrawals/", AdminWithdrawalListView.as_view(), name="admin-withdrawals"),
]
