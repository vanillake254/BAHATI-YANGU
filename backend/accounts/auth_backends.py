from __future__ import annotations

from typing import Optional

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


UserModel = get_user_model()


class CaseInsensitiveEmailBackend(ModelBackend):
    """Authenticate using email in a case-insensitive way.

    Django already normalises the domain part, but this backend lowercases the
    entire email address when looking up the user so that VANILLA@GMAIL.COM and
    vanilla@gmail.com are treated as the same account.
    """

    def authenticate(self, request, username: Optional[str] = None, password: Optional[str] = None, **kwargs):
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if username is None or password is None:
            return None

        email = username.strip().lower()

        try:
            user = UserModel._default_manager.get(email=email)
        except UserModel.DoesNotExist:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
