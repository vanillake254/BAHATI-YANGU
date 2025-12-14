from __future__ import annotations

from django.contrib import admin

from .models import GameRound, WheelSegment


@admin.register(WheelSegment)
class WheelSegmentAdmin(admin.ModelAdmin):
  list_display = ("label", "multiplier", "probability", "is_high_payout", "order")
  list_editable = ("probability", "multiplier", "order")
  ordering = ("order", "id")


@admin.register(GameRound)
class GameRoundAdmin(admin.ModelAdmin):
  list_display = ("user", "game_type", "stake", "win_amount", "is_win", "created_at")
  list_filter = ("game_type", "is_win")
  search_fields = ("user__email",)
  ordering = ("-created_at",)
