from django.urls import path

from .views import GameHistoryView, PredictPlayView, PickBoxPlayView, SpinPlayView, WheelConfigView

urlpatterns = [
    path("wheel/", WheelConfigView.as_view(), name="games-wheel-config"),
    path("spin/", SpinPlayView.as_view(), name="games-spin-play"),
    path("predict/", PredictPlayView.as_view(), name="games-predict-play"),
    path("pick-box/", PickBoxPlayView.as_view(), name="games-pick-box"),
    path("history/", GameHistoryView.as_view(), name="games-history"),
]
