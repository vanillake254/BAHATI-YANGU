from django.urls import path

from .views import ProfitStatusView

urlpatterns = [
    path("status/", ProfitStatusView.as_view(), name="profit-status"),
]
