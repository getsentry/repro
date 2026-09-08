# Reproduction for sentry-ruby#2457

**Issue:** https://github.com/getsentry/sentry-ruby/issues/2457

## Description

`RuntimeError: profile not started` is raised out of Sidekiq workers when Vernier
profiling (`config.profiler_class = Sentry::Vernier::Profiler`) is enabled and more
than one job runs concurrently in the same process.

**Status: the crash is fixed** (since 5.22.0 / 5.23.0 — see the matrix below), but on
current sentry-ruby the underlying limitation still means **no profiles at all are
produced** when Sidekiq runs more than one worker thread.

### Root cause

Vernier's profiler is a global singleton. From
[`vernier/lib/vernier.rb`](https://github.com/jhawthorn/vernier/blob/main/lib/vernier.rb):

```ruby
def self.start_profile(mode: :wall, **collector_options)
  if @collector
    @collector.stop          # <- stops whoever was already profiling
    @collector = nil
    raise "profile already started, stopping..."
  end
  ...
end

def self.stop_profile
  raise "profile not started" unless @collector
  ...
end
```

With two Sidekiq worker threads:

| step | thread A | thread B |
| --- | --- | --- |
| 1 | `Vernier.start_profile` → `@collector = A`, Sentry sets `@started = true` | |
| 2 | | `Vernier.start_profile` → **stops A's collector**, `@collector = nil`, raises `"profile already started, stopping..."` |
| 3 | `Vernier.stop_profile` → `@collector` is `nil` → raises **`"profile not started"`** | |

On 5.21.0 `Sentry::Vernier::Profiler#stop` had no `rescue`, so that `RuntimeError`
escaped `transaction.finish` and propagated out of
[`SentryContextServerMiddleware#finish_transaction`](https://github.com/getsentry/sentry-ruby/blob/master/sentry-sidekiq/lib/sentry/sidekiq/sentry_context_middleware.rb)
— exactly the error in the report.

## Steps to Reproduce

Requires Ruby 3.3 (`.ruby-version` pins 3.3.6) and, for the Sidekiq variant,
`redis-server` on `$PATH`. No Sentry DSN is needed — a dummy DSN is used and a no-op
transport drops every envelope. To send to a real project instead,
`export SENTRY_DSN=<your dsn>`.

### 1. Minimal variant (threads only, no Redis)

Mirrors what the Sidekiq server middleware does, without Sidekiq:

```bash
SENTRY_VERSION=5.21.0 bundle install
SENTRY_VERSION=5.21.0 bundle exec ruby threads_repro.rb
```

```
sentry-ruby 5.21.0 | vernier 1.11.0 | ruby 3.3.6
thread 1: ok
thread 3: ok
thread 0: RuntimeError: profile not started
thread 2: RuntimeError: profile not started

REPRODUCED: 2/4 transactions raised while finishing:
  2x RuntimeError: profile not started
```

Knobs: `THREADS=4` (default), `SENTRY_LOG=1` for the profiler's debug log.

### 2. Sidekiq variant (real Sidekiq + Redis)

Boots a throwaway Redis on port 6399, enqueues 12 jobs, runs Sidekiq with concurrency 5:

```bash
SENTRY_VERSION=5.21.0 bundle install
SENTRY_VERSION=5.21.0 ./run_sidekiq.sh
```

```
=== REPRODUCED - exceptions escaped the Sentry Sidekiq middleware ===
   3 !!! REPRODUCED - job raised RuntimeError: profile not started
```

### 3. Version matrix

```bash
./run_matrix.sh                      # 5.21.0 5.22.0 5.23.0 7.0.0
VERSIONS="5.21.0 7.0.0" ./run_matrix.sh
```

## Expected Behavior

No errors raised out of workers; profile samples from workers visible in Sentry.

## Actual Behavior

| sentry-ruby | result |
| --- | --- |
| **5.21.0** (reported) | `RuntimeError: profile not started` escapes the job |
| **5.22.0** | crash remains, different error: `NoMethodError: undefined method '_stack_table' for nil` (`stop` now rescues, but `@result` is `nil` and `to_hash` still builds output) |
| **5.23.0 – 7.0.0** | no exception; **0 of 4** concurrent transactions carry a profile |

Both crashes are fixed:

- [#2429](https://github.com/getsentry/sentry-ruby/pull/2429) "Fix issues with stopping Vernier" → first released in **5.22.0** (adds `rescue RuntimeError` to `Profiler#stop`)
- [#2528](https://github.com/getsentry/sentry-ruby/pull/2528) "Prevent starting Vernier in nested transactions" → first released in **5.23.0** (adds `return EMPTY_RESULT unless result`)

### Two things still worth noting on 7.0.0

**1. Concurrency yields zero profiles, not "one at a time".**

The discussion on the issue settled on "it is fine to profile only one thread at a
time and document that limitation". In practice it is worse than that: the loser's
`start_profile` *stops the winner's collector* before raising, so the winner's
`stop_profile` then fails too and its result is discarded. Nobody gets a profile.

```
$ THREADS=1 bundle exec ruby threads_repro.rb
Envelope items sent: profile=1, transaction=1
1/1 transactions carry a profile.

$ THREADS=2 bundle exec ruby threads_repro.rb
Envelope items sent: transaction=2
0/2 transactions carry a profile.
```

So with any Sidekiq concurrency > 1, Vernier profiling produces nothing.

`proposed_fix.rb` sketches a fix: a process-wide ownership guard on
`Sentry::Vernier::Profiler`, so a losing thread **never calls `::Vernier.start_profile`
at all** — that call is precisely what discards the winner's collector. Exactly one
profiler holds Vernier at a time and actually gets its result back.

```bash
bundle exec ruby threads_repro.rb   # 0/4 transactions carry a profile
bundle exec ruby fix_demo.rb        # 1/4 transactions carry a profile

./run_sidekiq.sh                    # 12 jobs, concurrency 5 -> profile=2,  transaction=12
SENTRY_FIX=1 ./run_sidekiq.sh       # 12 jobs, concurrency 5 -> profile=7,  transaction=12
```

That is the "profile one thread at a time" behaviour the issue thread settled on,
and it holds across sequential jobs (ownership is released in an `ensure`).

Caveats for whoever picks this up:

- **Leaked ownership.** If a transaction is started but never finished, `stop` never
  runs and profiling is dead for the rest of the process. Today's behaviour
  self-heals destructively — the next `start_profile` stops the stale collector. A
  guard probably wants a takeover after `max_profile_duration` rather than waiting
  forever.
- **Non-SDK owners.** Sidekiq 8 profiles with Vernier natively, and rack-mini-profiler
  / a manual `Vernier.profile` block can hold the collector too. Sentry can't see
  those (Vernier exposes no public "is a profile running?" accessor — only the private
  `Vernier.@collector`), so the `rescue RuntimeError` has to stay regardless. Note
  Sentry's `start_profile` *also* kills an external collector when it wins the race.
- **Alternative design.** Vernier's `:wall` mode already samples every thread in the
  process. One long-lived collector, sliced per transaction by time window and thread
  id, would profile all concurrent jobs instead of one — much closer to what users
  expect here, but a substantially bigger change.

**2. The friendly log branches are dead code (string-case mismatch).**

[`profiler.rb`](https://github.com/getsentry/sentry-ruby/blob/master/sentry-ruby/lib/sentry/vernier/profiler.rb)
matches on a capital `P`:

```ruby
if e.message.include?("Profile already started")   # Vernier raises "profile already started, stopping..."
if e.message.include?("Profile not started")       # Vernier raises "profile not started"
```

Vernier's messages are lowercase, so the intended "Not started since running
elsewhere" / "Not stopped since not started" branches never run. Observed with
`SENTRY_LOG=1` on 7.0.0:

```
[Profiler::Vernier] Started
[Profiler::Vernier] Failed to start: profile already started, stopping...
[Profiler::Vernier] Failed to stop Vernier: profile not started
```

Cosmetic (both are `debug`-level and the exception is swallowed either way), but the
expected contention path is reported as a failure.

## Environment

- Ruby: 3.3.6 (issue reported on 3.3.4)
- sentry-ruby / sentry-sidekiq: 5.21.0 (reported), also tested 5.22.0, 5.23.0, 7.0.0
- vernier: 1.11.0 (issue reported on 1.3.1)
- sidekiq: 7.3.10 (issue reported on 7.1.6)
- OS: macOS (darwin arm64)

## Files

| file | purpose |
| --- | --- |
| `threads_repro.rb` | minimal repro, no Redis; replays the middleware's start/finish sequence on N threads |
| `sidekiq_app.rb` | Sentry + Sidekiq setup and the CPU-burning job |
| `enqueue.rb` | pushes jobs onto the queue |
| `run_sidekiq.sh` | boots Redis, enqueues, runs Sidekiq with concurrency 5, reports escaped exceptions and profile counts (`SENTRY_FIX=1` applies the fix) |
| `run_matrix.sh` | runs `threads_repro.rb` across several sentry-ruby versions |
| `proposed_fix.rb` | sketch of an ownership guard so one profiler at a time actually keeps its result |
| `fix_demo.rb` | `threads_repro.rb` with `proposed_fix.rb` applied |
