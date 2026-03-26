# Reproduction for sentry-ruby#2912

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2912

## Description

`sentry-rails` triggers a "Prematurely executing load hooks" deprecation warning for `:action_dispatch_response` on Rails 8.2. The root cause is `ActionController::Live.send(:prepend, ...)` inside an `on_load(:action_controller)` block in the railtie, which eagerly loads `ActionDispatch::Response` and triggers its load hook prematurely.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Run the reproduction:
   ```bash
   export SENTRY_DSN=
   bundle exec ruby repro.rb
   ```

## Expected Behavior

No premature load hook warning on boot. The `ActionController::Live` prepend should be deferred to avoid triggering early loading of `ActionDispatch::Response`.

## Actual Behavior

The following deprecation warning is emitted on boot:

```
:action_dispatch_response was loaded before application initialization.
Prematurely executing load hooks will slow down your boot time
and could cause conflicts with the load order of your application.
```

The stack trace shows the chain:
- `sentry-rails/railtie.rb:95` calls `ActionController::Live.send(:prepend, ...)`
- This requires `action_controller/metal/live.rb`
- Which requires `action_dispatch/http/response.rb`
- Which calls `ActiveSupport.run_load_hooks(:action_dispatch_response, ...)` prematurely

## Environment

- Ruby: 3.3.5
- sentry-ruby: 5.28.1
- sentry-rails: 5.28.1
- Rails: 8.2.0.alpha (edge/main)
