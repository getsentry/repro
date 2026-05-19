"""Minimal Django settings for Celery reproduction."""

SECRET_KEY = "repro-secret-key"
DEBUG = True
INSTALLED_APPS = ["django.contrib.contenttypes"]
DATABASES = {}
USE_TZ = True

# Celery
CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
CELERY_TASK_ALWAYS_EAGER = False
