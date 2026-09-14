# Reproduction for sentry-ruby#3078

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3078

## Description

Sentry's Faraday integration attempts to insert its middleware every time a
`Faraday::Connection` is initialized. When multiple connections reuse the same
`Faraday::RackBuilder`, the first request locks the builder. Constructing a
second connection then raises `Faraday::RackBuilder::StackLocked` instead of
reusing the already-instrumented builder.

The reproduction uses Faraday's test adapter, so it does not make a network
request.

## Steps to Reproduce

1. Install dependencies:

   ```bash
   bundle install
   ```

2. Run the reproduction:

   ```bash
   bundle exec ruby repro.rb
   ```

   The `SENTRY_DSN` environment variable is not needed because this
   reproduction explicitly disables sending with `config.dsn = nil`. If you
   want to run it with a DSN, export `SENTRY_DSN` first and update the
   configuration accordingly.

## Expected Behavior

The fallback connection is constructed successfully. Sentry should detect that
the shared builder has already been instrumented and avoid inserting its
middleware a second time.

## Actual Behavior

The final `Faraday.new` raises:

```text
Faraday::RackBuilder::StackLocked: can't modify middleware stack after making a request
```

The stack trace points to Sentry's Faraday integration calling
`RackBuilder#insert` after the builder has been locked.

## Environment

- Ruby: 4.0.5 (the issue reports Ruby 4.0.2)
- sentry-ruby: 7.0.0
- Faraday: 1.10.6
- OS: macOS (the issue is not expected to be OS-specific)
