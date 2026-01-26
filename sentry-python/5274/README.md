# Reproduction for sentry-python#5274

**Issue:** https://github.com/getsentry/sentry-python/issues/5274

## Description

When running Django under ASGI with `send_default_pii=True`, Sentry's Django integration calls `request.user.is_authenticated` synchronously in the ASGI event processor. On Django 5.x this triggers lazy session-backed user resolution in an async context and raises `SynchronousOnlyOperation`.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Set up the database and create a superuser:
   ```bash
   uv run python manage.py migrate
   uv run python manage.py createsuperuser --username admin --email admin@example.com
   ```

3. (Optional) Set your Sentry DSN to see events:
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

4. Run the server with uvicorn (ASGI):
   ```bash
   uv run uvicorn asgi:application --host 127.0.0.1 --port 8000
   ```

5. In a browser:
   - Go to http://127.0.0.1:8000/admin/ and log in
   - Then visit http://127.0.0.1:8000/

6. Check the console output for the error.

## Expected Behavior

The Sentry SDK should capture errors without raising `SynchronousOnlyOperation`. In async contexts, the Django integration should use async-safe APIs (e.g., `request.auser()`) or skip user capture.

## Actual Behavior

Sentry logs an internal SDK error:

```
SynchronousOnlyOperation: You cannot call this from an async context - use a thread or sync_to_async.
```

The error occurs in the stack:
```
.../sentry_sdk/integrations/django/__init__.py in is_authenticated
    return request_user.is_authenticated
.../sentry_sdk/integrations/django/__init__.py in _set_user_info
    if user is None or not is_authenticated(user):
.../sentry_sdk/integrations/django/asgi.py in asgi_request_event_processor
    _set_user_info(request, event)
```

## Workaround

Set `send_default_pii=False` and manually call `sentry_sdk.set_user()` after resolving the user asynchronously.

## Environment

- Python: 3.11+
- Django: 5.1+
- sentry-sdk: 2.48.0+
- ASGI server: uvicorn
