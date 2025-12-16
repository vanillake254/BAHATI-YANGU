from __future__ import annotations

from datetime import timedelta
from pathlib import Path
import os

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-change-me")

DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"

ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "accounts",
    "wallet",
    "transactions",
    "games",
    "payments",
    "profit_engine",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

# Database
if "DATABASE_URL" in os.environ:
    DATABASES = {
        "default": dj_database_url.parse(
            os.environ["DATABASE_URL"], conn_max_age=600, ssl_require=False
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "accounts.auth_backends.CaseInsensitiveEmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

from datetime import timedelta as _timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    origin
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:5174,https://bahati-yangu.web.app,https://vanillasoftwares.web.app",
    ).split(",")
    if origin
]

CSRF_TRUSTED_ORIGINS = [
    origin
    for origin in os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:5173,http://localhost:5174,https://bahati-yangu.web.app,https://vanillasoftwares.web.app",
    ).split(",")
    if origin
]

CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)

INTASEND_PUBLIC_KEY = os.environ.get("INTASEND_PUBLIC_KEY", "")
INTASEND_SECRET_KEY = os.environ.get("INTASEND_SECRET_KEY", "")
INTASEND_ENV = os.environ.get("INTASEND_ENV", "sandbox")
INTASEND_DEVICE_ID = os.environ.get("INTASEND_DEVICE_ID", "")

FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "https://bahati-yangu.web.app")

# Date after which to count deposits/withdrawals for global stats (ISO format)
# Set this to reset stats without deleting history
STATS_RESET_DATE = os.environ.get("STATS_RESET_DATE", "2025-12-16T13:00:00+00:00")

HOUSE_TARGET_MARGIN = float(os.environ.get("HOUSE_TARGET_MARGIN", "0.75"))
HOUSE_MARGIN_NORMALIZER = float(os.environ.get("HOUSE_MARGIN_NORMALIZER", "0.2"))
HOUSE_W_MULTIPLIER = float(os.environ.get("HOUSE_W_MULTIPLIER", "0.6"))
HOUSE_W_PROB = float(os.environ.get("HOUSE_W_PROB", "0.4"))
HOUSE_HIGH_MULTIPLIER_THRESHOLD = float(
    os.environ.get("HOUSE_HIGH_MULTIPLIER_THRESHOLD", "5.0")
)
HOUSE_MIN_MULTIPLIER = float(os.environ.get("HOUSE_MIN_MULTIPLIER", "1.1"))
HOUSE_MAX_AUTOMATED_ADJUSTMENTS_PER_HOUR = int(
    os.environ.get("HOUSE_MAX_AUTOMATED_ADJUSTMENTS_PER_HOUR", "12")
)
