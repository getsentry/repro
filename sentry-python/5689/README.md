# Reproduction for sentry-python#5689

**Issue:** https://github.com/getsentry/sentry-python/issues/5689

## Description

When using Django + Celery with `enable_logs=True`, "task succeeded" log messages from `celery.app.trace` are filtered out of Sentry Logs. This happens because `ignore_logger("celery.app.trace")` in the Celery integration adds the logger to `_IGNORED_LOGGERS`, which is shared between breadcrumb filtering and the new Sentry Logs feature.

## Steps to Reproduce

1. Start Redis:
   ```bash
   redis-server
   ```

2. Start the Celery worker:
   ```bash
   export SENTRY_DSN=<your-dsn>
   uv run celery -A celery_app worker --loglevel=info
   ```

3. In another terminal, trigger the task:
   ```bash
   export SENTRY_DSN=<your-dsn>
   uv run python trigger_task.py
   ```

## Expected Behavior

Both logs appear in Sentry Logs:
- `Task add[uuid] received` (from `celery.worker.request`)
- `Task add[uuid] succeeded in 0.123s: 5` (from `celery.app.trace`)

## Actual Behavior

Only the "received" log appears in Sentry Logs. The "succeeded" log is filtered out because `celery.app.trace` is in `_IGNORED_LOGGERS`:

```
_IGNORED_LOGGERS: {'celery.worker.job', 'celery.redirected', 'celery.app.trace', ...}
```

The `ignore_logger()` call was intended for breadcrumbs but also blocks Sentry Logs.

## Environment

- Python: 3.x
- sentry-sdk: 2.56.0
- celery: >= 5.4
- django: >= 4.2
