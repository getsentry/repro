import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

import django

django.setup()

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    integrations=[
        CeleryIntegration(),
        LoggingIntegration(event_level=None),
    ],
    enable_logs=True,
    debug=True,
)

from celery import Celery

app = Celery("repro", broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"))
app.config_from_object("django.conf:settings", namespace="CELERY")


@app.task
def add(x, y):
    """A simple task to demonstrate the bug."""
    result = x + y
    print(f"Task result: {result}")
    return result
