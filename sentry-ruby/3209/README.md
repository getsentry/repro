# Reproduction for sentry-ruby#3209

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3209

## Description

When an envelope item is still larger than `MAX_SERIALIZED_PAYLOAD_SIZE` after
`Envelope::Item#serialize` removes breadcrumbs and trims stack frames,
`Transport#serialize_envelope` skips it with only a `log_debug` line. No lost
event is recorded, so no client report reaches Sentry, and at the usual `info`
log level nothing is logged at all.

The size reduction does not touch `extra` or `contexts`, so a large custom
payload (here about 1.3 MB of ids in `extra`) is enough to trigger the drop.

The script uses an in-memory transport and a dummy DSN, so nothing is sent.

## Steps to Reproduce

1. Install dependencies:

   ```bash
   bundle install
   ```

2. Run the reproduction:

   ```bash
   bundle exec ruby repro.rb
   ```

   The script exits 1 while the bug is present and 0 once it is fixed.

## Expected Behavior

- The drop is logged at `warn` level, like the HTTP 413 path.
- A lost event is recorded (`[:send_error, "error"]` in
  `transport.discarded_events`), so it shows up in the org's stats via client
  reports.

## Actual Behavior

```text
envelopes sent:    0
discarded events:  {}
warn+ log lines:   0
BUG: the oversized event was not recorded as a lost event
BUG: the drop was not logged at warn level or above
```

## Environment

- Ruby: 4.0.9
- sentry-ruby: 7.2.0
