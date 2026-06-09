# Reproduction for sentry-ruby yabeda-memory-growth

**Reference:** https://github.com/getsentry/sentry-ruby/issues/2963

**SDK:** sentry-ruby v6.6.1, sentry-yabeda v6.6.1

## Description

Steady memory growth in a Rails 8 production app using Sentry SDK telemetry (logs + metrics) with yabeda plugins. After the deadlock fix in 6.6.1, memory growth persists — lower than before, but unbounded.

This reproduction discovers **two distinct issues**:

### Bug: `Scope#apply_to_telemetry` mutates caller's hash in-place

`sentry-ruby`'s `Scope#apply_to_telemetry` (scope.rb:96-105) adds sentry-specific attributes (`sentry.sdk.name`, `sentry.sdk.version`, `sentry.environment`, `server.address`) directly onto the `MetricEvent#attributes` hash. Since `MetricEvent` stores the caller's hash by reference (not a copy), this mutates the same hash object that yabeda uses as a key in its `metric.values` (Concurrent::Hash).

**Call chain:**
```
Yabeda::Counter#increment({kind: "User Load"})
  → Tags.build → {kind: "User Load"}
  → metric.values[tags] ||= Concurrent::Atom.new(0)   # stored as hash key
  → adapter.perform_counter_increment!(self, tags, by)
    → Sentry.metrics.count(attributes: tags)            # same object reference
      → MetricEvent.new(attributes: tags)               # @attributes = tags (no copy)
        → scope.apply_to_telemetry(event)
          → event.attributes["sentry.sdk.name"] = ...   # MUTATES the hash key!
```

After mutation, the hash key's content (and hash code) has changed, but it remains in its original hash bucket. Future lookups with `{kind: "User Load"}` can never find it — **every single metric increment creates a new orphaned entry**, regardless of whether the tag combination was seen before.

### Pre-existing: Yabeda's unbounded metric values hash

Even without Sentry, yabeda's `Metric#values` (a `Concurrent::Hash` keyed by frozen tag hashes) grows monotonically — no eviction, no TTL, no cardinality limit. With high-cardinality plugins like `yabeda-http_requests` (unbounded `host` tag) and `yabeda-activerecord` (~2,400 kind×cached×async combos), this retains thousands of `Concurrent::Atom` objects permanently.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

   Or use Docker:
   ```bash
   docker build -t yabeda-repro .
   ```

2. Run **without** sentry-yabeda (baseline — bounded yabeda growth only):
   ```bash
   bundle exec ruby repro.rb
   # or: docker run --rm yabeda-repro
   ```

3. Run **with** sentry-yabeda (shows the hash mutation bug):
   ```bash
   SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0 bundle exec ruby repro.rb
   # or: docker run --rm -e SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0 yabeda-repro
   ```

## Expected Behavior

With sentry-yabeda enabled, yabeda's `values` hash should grow at the same rate as without it — bounded by the number of unique tag combinations.

## Actual Behavior

### Without sentry-yabeda (bounded growth)

```
Part 2: Memory growth at scale (yabeda only)

Initial: RSS=22288 KB, live_slots=50594

Round       RSS      +RSS  LiveSlots   OldObjs    Values
------------------------------------------------------------
    1   22416 KB    +128     52478     50453       292
   10   23056 KB    +768     61701     59566      1748
   20   23824 KB   +1536     70228     68235      3038

Per-metric breakdown:
  active_record_instantiation_total             50 unique tag combos
  active_record_sql_query_duration              200 unique tag combos
```

Growth plateaus as the finite tag space is exhausted. `active_record_instantiation_total` (50 AR model kinds) correctly shows 50 entries.

### With sentry-yabeda (unbounded growth)

```
Part 1: Proving Scope#apply_to_telemetry mutates yabeda's tag hash in-place

After 5 identical increments of {kind: 'TestModel Load'}:
  values.size = 5  (expected: 1, got: 5)

Sample stored keys (should all be identical, but each call creates a new entry):
  [0] {:kind=>"TestModel Load", "sentry.sdk.name"=>"sentry.ruby", ...}
  [1] {:kind=>"TestModel Load", "sentry.sdk.name"=>"sentry.ruby", ...}
  [2] {:kind=>"TestModel Load", "sentry.sdk.name"=>"sentry.ruby", ...}

Part 2: Memory growth at scale (yabeda + sentry-yabeda)

Initial: RSS=28680 KB, live_slots=66415

Round       RSS      +RSS  LiveSlots   OldObjs    Values
------------------------------------------------------------
    1   28936 KB    +256     70074     66266       385
   10   47368 KB  +18688     95403     90145      3823
   20   50056 KB  +21376    120427   117481      7644

Per-metric breakdown:
  active_record_instantiation_total             2005 unique tag combos
  active_record_sql_query_duration              2000 unique tag combos
```

`active_record_instantiation_total` jumps from 50 → 2005 entries (one per increment call instead of one per unique tag combo). RSS growth is **14x worse** (+21 MB vs +1.5 MB).

## Root Cause

In `sentry-ruby` v6.6.1, `Scope#apply_to_telemetry` ([scope.rb:96-105](https://github.com/getsentry/sentry-ruby/blob/6.6.1/sentry-ruby/lib/sentry/scope.rb#L96-L105)):

```ruby
telemetry.attributes["sentry.sdk.name"] ||= Sentry.sdk_meta["name"]
telemetry.attributes["sentry.sdk.version"] ||= Sentry.sdk_meta["version"]
telemetry.attributes["sentry.environment"] ||= configuration.environment
telemetry.attributes["server.address"] ||= configuration.server_name
```

And `MetricEvent#initialize` ([metric_event.rb:23](https://github.com/getsentry/sentry-ruby/blob/6.6.1/sentry-ruby/lib/sentry/metric_event.rb#L23)):

```ruby
@attributes = attributes || {}  # no .dup — stores caller's hash by reference
```

**Fix:** Either `MetricEvent` should `.dup` the attributes hash, or `Scope#apply_to_telemetry` should work on a copy.

## Environment

- Ruby: 3.3
- sentry-ruby: 6.6.1
- sentry-yabeda: 6.6.1
- yabeda: 0.16.0
