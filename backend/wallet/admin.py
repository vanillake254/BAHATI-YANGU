from __future__ import annotations

from django.contrib import admin

from .models import Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
  list_display = ("user", "balance", "updated_at")
  search_fields = ("user__email", "user__mpesa_number")
  ordering = ("-updated_at",)
