# Reproduction for sentry-ruby#3038

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3038

## Description

`Sentry::SessionFlusher#add_session` updates `@pending_aggregates` without
holding `@mutex`, in two separate lookups:

```ruby
@pending_aggregates[session.aggregation_key] ||= init_aggregates(session.aggregation_key)
@pending_aggregates[session.aggregation_key][session.status] += 1
```

The flusher thread swaps in a fresh hash under `@mutex` in `#pending_envelope`.
Only the flush side takes the lock, so it excludes nothing. If the swap lands
between the two lookups, the second lookup hits the new, empty hash and raises
`NoMethodError: undefined method '[]' for nil`. In an app this is raised from
`Hub#end_session`, which runs in the Rack middleware's `ensure`. A swap that
lands at other points silently drops the session from the flushed envelope.

`repro.rb` runs two scenarios:

1. **deterministic**: while `add_session` is between its two lookups, start the
   flush swap on another thread and give it 0.5s to complete. This makes the
   interleaving deterministic.
2. **stress**: no hooks. One thread calls `add_session` in a loop while
   another calls the real `#pending_envelope` swap in a loop. Counts crashes
   and sessions that never show up in a flushed envelope.

No events are sent. `SENTRY_DSN` is optional (`export SENTRY_DSN=`); the
repro uses `Sentry::DummyTransport` either way.

## Steps to Reproduce

1. Install dependencies:

   ```bash
   bundle install
   ```

2. Run the reproduction against the released gem (7.2.0):

   ```bash
   bundle exec ruby repro.rb
   ```

   Optional knobs: `STRESS_SECONDS=15` runs the stress scenario longer, and
   `RUBY_THREAD_TIMESLICE=1` (Ruby 3.3+) makes MRI switch threads more often,
   which hits the race far more frequently.

3. Run it against a local sentry-ruby checkout, such as a fix branch:

   ```bash
   SENTRY_RUBY_PATH=/path/to/sentry-ruby/sentry-ruby BUNDLE_GEMFILE=Gemfile.patched bundle exec ruby repro.rb
   ```

The script exits 1 when the bug reproduces and 0 when both scenarios pass.

## Expected Behavior

`add_session` never raises, and every added session is included in exactly
one flushed envelope.

## Actual Behavior

On sentry-ruby 7.2.0 (Ruby 4.0.9):

```text
== 1. deterministic: swap lands between the two lookups in add_session
BUG: add_session raised NoMethodError: undefined method '[]' for nil
     at .../sentry-ruby-7.2.0/lib/sentry/session_flusher.rb:33:in 'Sentry::SessionFlusher#add_session'

== 2. stress: real add_session thread vs. real flush-swap thread (5.0s)
sessions added without error: 3144184
add_session crashes (NoMethodError): 7
  e.g. undefined method '[]' for nil
sessions missing from flushed envelopes: 12
BUG: concurrent add_session + flush is not safe

RESULT: FAIL - bug reproduced (2/2 scenarios)
```

With `RUBY_THREAD_TIMESLICE=1 STRESS_SECONDS=15`, the stress scenario showed
286 crashes and 225 lost sessions out of about 8.6M.

When `add_session` takes `@mutex` around both lookups, both scenarios pass,
including 15s at a 1ms timeslice with 0 crashes and 0 lost sessions out of
about 8.4M.

## Environment

- Ruby: 4.0.9 and 3.2.11 (both reproduce)
- sentry-ruby: 7.2.0
- OS: Linux (not expected to be OS-specific)
