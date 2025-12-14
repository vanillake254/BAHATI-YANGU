from django.urls import path

from .views import DepositInitView, WithdrawInitView, PaymentStatusView

urlpatterns = [
    path("deposit/", DepositInitView.as_view(), name="payments-deposit-init"),
    path("withdraw/", WithdrawInitView.as_view(), name="payments-withdraw-init"),
    path("status/<int:tx_id>/", PaymentStatusView.as_view(), name="payments-status"),
]
