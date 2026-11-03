# Reproduction for sentry-ruby#3166

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3166
**Proposed fix:** https://github.com/getsentry/sentry-ruby/pull/3167

## Description

With `config.rails.register_error_subscriber = true`, an exception raised in a view is reported twice:

1. `Sentry::Rails::CaptureExceptions` captures the `ActionView::Template::Error` and marks that object as captured.
2. `ActionDispatch::Executor` (or `ActionDispatch::Reloader` in development) reports `ExceptionWrapper#unwrapped_exception`, which is the wrapper's `cause`, to `Rails.error`. `Sentry::Rails::ErrorSubscriber` forwards it, and because the cause is a different object, `Hub#capture_exception` doesn't skip it.

The two events have different types and stacks, so they group as separate issues. With reloading off (production), the second event has no request context.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Run the reproduction (production order, reloading off):
   ```bash
   bundle exec ruby repro.rb
   ```

3. Run it with reloading on (development order):
   ```bash
   bundle exec ruby repro.rb reloading
   ```

Events are captured in-process with `Sentry::DummyTransport`. To send them to a real project, `export SENTRY_DSN=...` first.

To test a local sentry-ruby checkout (e.g. a fix branch) instead of the released gem:

```bash
SENTRY_RUBY_PATH=/path/to/sentry-ruby BUNDLE_GEMFILE=Gemfile.local bundle exec ruby repro.rb
```

(Copy `Gemfile` to `Gemfile.local` first so the released `Gemfile.lock` stays untouched.)

## Expected Behavior

One event per view error, with request context.

## Actual Behavior

sentry-rails 7.1.0, reloading off:

```
events (2):
  ActionView::Template::Error url="http://example.org/"
  RuntimeError url=nil
BUG: expected 1 event, got 2
```

Reloading on:

```
events (2):
  RuntimeError url="http://example.org/"
  ActionView::Template::Error url="http://example.org/"
BUG: expected 1 event, got 2
```

Same on sentry-ruby master (`6a919396`, 7.2.0). With PR #3167 (`20dad7e6`), both modes produce one event with a request URL.

## Environment

- Ruby: 4.0
- Rails: 8.1.4
- sentry-ruby / sentry-rails: 7.1.0
