# Reproduction for sentry-ruby#3144

**Issue:** https://github.com/getsentry/sentry-ruby/issues/3144

## Description

sidekiq-scheduler enqueues jobs from its own long-lived scheduler thread. That
thread's Sentry scope builds a `PropagationContext` (fixing `trace_id` and
`sample_rand`) once and never regenerates it. `SentryContextClientMiddleware`
then stamps every scheduled job with the same `sentry-trace` (no sampled flag)
and `baggage` (with `sentry-sample_rand`). On the server, `continue_trace`
reuses that `sample_rand`, so with `traces_sample_rate` / `traces_sampler` = 0.5
every scheduled job in a process is either sampled or not, flipping per boot.

The sidekiq-cron patch avoids this by wrapping `enqueue!` in a fresh
hub/scope/transaction ([sentry-ruby#2446](https://github.com/getsentry/sentry-ruby/pull/2446)); the `:sidekiq_scheduler` patch only adds Crons
check-ins and does not touch `enqueue_job`.

`run.sh` boots Sidekiq several times with a job scheduled every second and
records `trace_id`, `sample_rand` and `sampled` from inside each job.

## Steps to Reproduce

Requires Redis >= 7 or Valkey (Sidekiq 8).

1. Install dependencies:

   ```bash
   bundle install
   # issue was reported on 6.7.0:
   # SENTRY_VERSION=6.7.0 bundle update sentry-ruby sentry-sidekiq
   ```

2. Run the reproduction (no DSN needed; a dummy DSN + null transport is used
   unless you `export SENTRY_DSN=...`):

   ```bash
   ./run.sh
   # with Valkey:
   REDIS_SERVER=valkey-server REDIS_CLI=valkey-cli ./run.sh
   # knobs: BOOTS=6 DURATION=5 REDIS_PORT=6399
   ```

3. Apply the workaround from the issue (fresh propagation context per
   scheduled enqueue) to see the expected behaviour:

   ```bash
   SENTRY_FIX=1 ./run.sh
   ```

## Expected Behavior

Each scheduled enqueue starts a fresh trace, so `traces_sampler` = 0.5 applies
independently to each run (~50% sampled within every boot).

## Actual Behavior

Observed with sentry-ruby/sentry-sidekiq 7.1.0 (same on 6.7.0):

```
boot  jobs  trace_ids sample_rands sampled       trace_id / sample_rand
1     3     1         1            false=3       5562e9dd58fa45de9e31fd2416fc06a3 / 0.788176
2     4     1         1            true=4        bb0a9aeb2c524fe9af01d15c86337f67 / 0.25121
3     4     1         1            false=4       a689c8ee35fe4d569a2e9ecdbbc05c46 / 0.631242
4     4     1         1            false=4       7f0f02a245394480ba2ec667b435176a / 0.533177
5     3     1         1            false=3       7bf68ab9af6741b791f2f48b2a74abc9 / 0.815541
6     4     1         1            true=4        6c076d1c9adf4deeba9fc835eb1e73ab / 0.499291

REPRODUCED: every scheduled job within a boot shares one trace_id/sample_rand, so the sampling decision is all-or-nothing per process.
```

With `SENTRY_FIX=1`:

```
boot  jobs  trace_ids sample_rands sampled       trace_id / sample_rand
1     7     7         7            true=5,false=2 (7 distinct)
2     7     7         7            true=5,false=2 (7 distinct)
```

## Environment

- Ruby: 3.4.11 (issue: 3.3.6)
- sentry-ruby / sentry-sidekiq: 7.1.0 and 6.7.0
- sidekiq: 8.1.7 (issue: 8.0.10)
- sidekiq-scheduler: 6.0.2 (issue: 6.0.1)
- Valkey 9.0.6
