from django.urls import path

from .views import WalletDetailView, AdminResetWalletsView

urlpatterns = [
    path("me/", WalletDetailView.as_view(), name="wallet-me"),
    path("admin/reset/", AdminResetWalletsView.as_view(), name="wallet-admin-reset"),
]
