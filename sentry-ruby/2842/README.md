# Reproduction for sentry-ruby#2842

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2842

## Description

`Sentry.metrics.count` (and other metrics methods) do not include user attributes (`user.id`, `user.email`) even when a user has been set via `Sentry.set_user`. According to the [Metrics documentation](https://docs.sentry.io/platforms/ruby/guides/rails/metrics/#user-attributes), user information should be automatically added to any metrics published.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

3. Run the Rails server:
   ```bash
   bundle exec rails server
   ```

4. Visit http://localhost:3000/test in your browser

5. Check:
   - The console output shows user info IS present in the Sentry scope
   - The Sentry dashboard shows the metric WITHOUT user attributes

## Expected Behavior

The metric `test.metric.count` should include `user.id` and `user.email` as tags/attributes, as documented.

## Actual Behavior

Only the attributes explicitly passed via the `attributes` parameter are included in the metric. User attributes from `Sentry.set_user` are ignored.

## Environment

- Ruby: 3.x
- sentry-ruby: 6.3.0
- Rails: 8.x
