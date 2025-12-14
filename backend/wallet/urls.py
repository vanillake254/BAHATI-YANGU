from django.urls import path

from .views import WalletDetailView

urlpatterns = [
    path("me/", WalletDetailView.as_view(), name="wallet-me"),
]
