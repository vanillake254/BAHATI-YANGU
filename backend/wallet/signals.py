from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Wallet

User = get_user_model()


@receiver(post_save, sender=User)
def create_wallet_for_user(sender, instance: User, created: bool, **kwargs) -> None:
    if created:
        Wallet.objects.create(user=instance)
