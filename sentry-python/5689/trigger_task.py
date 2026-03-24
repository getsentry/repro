"""Trigger the Celery task and wait for its result."""

import os
import sys

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

from celery_app import add

print("Sending task add(2, 3)...")
result = add.delay(2, 3)

print(f"Task ID: {result.id}")
print("Waiting for result...")

try:
    value = result.get(timeout=10)
    print(f"Task returned: {value}")
except Exception as e:
    print(f"Error: {e}")

# Flush Sentry events
sentry_sdk.flush(timeout=5)
print("\nDone. Check Sentry Logs:")
print('  - You should see "Task add[...] received"')
print('  - BUG: "Task add[...] succeeded in ..." is missing from Sentry Logs')
print('  - The "succeeded" log comes from celery.app.trace which is in _IGNORED_LOGGERS')
