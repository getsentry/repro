# Reproduction for sentry-ruby#3037

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3037

## Description

`Sentry::Transport` keeps lost-event counts in `@discarded_events`, a plain
Hash with no lock. `#fetch_pending_client_report` iterates it with `map` while
`#record_lost_event` inserts into it from any thread:

```ruby
@discarded_events[[reason, data_category]] += num
```

Ruby forbids adding a key to a Hash during iteration and raises in the
inserting thread, so `record_lost_event` raises
`RuntimeError: can't add a new key into hash during iteration`. Its callers
include `Client#capture_event` on request threads and the background worker.

`repro.rb` runs two scenarios:

1. **deterministic**: pause the real Hash iteration in
   `fetch_pending_client_report` after its first entry, and call the real
   `record_lost_event` with a new key from another thread at that moment.
2. **stress**: no hooks. One thread calls `record_lost_event` in a loop while
   the main thread builds client reports. As in the issue, the hash is widened
   to 20k keys so the iteration window is long enough to hit reliably. In
   production the hash holds only a few keys, so the window is much smaller.

No events are sent: the repro uses a dummy DSN and `Sentry::DummyTransport`.

## Steps to Reproduce

1. Install dependencies:

   ```bash
   bundle install
   ```

2. Run the reproduction against the released gem (7.2.0):

   ```bash
   bundle exec ruby repro.rb
   ```

   `STRESS_ROUNDS=500` runs the stress scenario longer.

3. Run it against a local sentry-ruby checkout, such as a fix branch:

   ```bash
   SENTRY_RUBY_PATH=/path/to/sentry-ruby/sentry-ruby BUNDLE_GEMFILE=Gemfile.patched bundle exec ruby repro.rb
   ```

The script exits 1 when the bug reproduces and 0 when both scenarios pass.

## Expected Behavior

`record_lost_event` never raises, and an event recorded while a client report
is being built is counted in the next report.

## Actual Behavior

On sentry-ruby 7.2.0 (Ruby 4.0.9):

```text
== 1. deterministic: record_lost_event while a client report is iterating
BUG: record_lost_event raised RuntimeError: can't add a new key into hash during iteration
     at .../sentry-ruby-7.2.0/lib/sentry/transport.rb:174:in 'Hash#[]='

== 2. stress: real record_lost_event thread vs. real client report builds (200 rounds)
record_lost_event calls: 2911791
record_lost_event errors: 532662
BUG: e.g. RuntimeError: can't add a new key into hash during iteration

RESULT: FAIL - bug reproduced (2/2 scenarios)
```

When `fetch_pending_client_report` swaps out `@discarded_events` under a mutex
that `record_lost_event` also takes, and iterates the old hash after the swap,
both scenarios pass with 0 errors out of about 7-9M calls.

## Environment

- Ruby: 4.0.9
- sentry-ruby: 7.2.0
- OS: Linux (not expected to be OS-specific)
