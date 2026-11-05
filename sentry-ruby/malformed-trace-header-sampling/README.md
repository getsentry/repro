# Reproduction for sentry-ruby malformed-trace-header-sampling

**SDK:** sentry-ruby v7.2.0 (also present on master)

## Description

`Sentry::PropagationContext::SENTRY_TRACE_REGEXP` makes the trace ID, span ID, and
sampled flag all optional. A `sentry-trace` header such as `-1`, `1`, or `--1`
therefore parses to `[nil, nil, true]`: no trace ID, no parent span ID, but
`parent_sampled = true`.

With a plain `traces_sample_rate` (no custom `traces_sampler`), an inherited
`parent_sampled` takes precedence over the configured rate, so these requests are
always sampled. `-0` does the opposite and drops every transaction. The SDK also
treats the request as a continued trace and freezes an empty DSC, so it stops
acting as head of trace.

This is a parser-hardening issue, not an auth bypass: any client can already send a
well-formed sampled header (last row below) and get the same sampling outcome.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. (Optional) export a DSN. Not required: every transaction is counted and then
   dropped in `before_send_transaction`, so nothing is sent.
   ```bash
   export SENTRY_DSN=
   ```

3. Run the reproduction:
   ```bash
   bundle exec ruby repro.rb
   ```

4. (Optional) run it against a local sentry-ruby checkout to verify a fix:
   ```bash
   SENTRY_RUBY_PATH=/path/to/sentry-ruby/sentry-ruby bundle install
   SENTRY_RUBY_PATH=/path/to/sentry-ruby/sentry-ruby bundle exec ruby repro.rb
   ```

## Expected Behavior

A `sentry-trace` header without a valid 32-hex trace ID is ignored. Those requests
are sampled at `traces_sample_rate` (~1%), like requests without the header, and the
SDK populates its own DSC as head of trace.

## Actual Behavior

`-1`, `1`, and `--1` are sampled 100% of the time with an empty DSC, and `-0`
drops 100% of transactions even at `traces_sample_rate = 1.0`.

## Reproduction Evidence

```
sentry-ruby 7.2.0, traces_sample_rate=0.01, 500 requests per case
extract_sentry_trace("-1") => [nil, nil, true]

(no header)                                   sampled    4/500 (  0.8%)  parent_span_id=nil                dsc={"trace_id" => "4b4212bdd46d450cae6cb3d56a243feb", "sample_rate" => "0.01", "sample_rand" => "0.000937", "sampled" => "true", "environment" => "development", "public_key" => "public"}
-1  (malformed)                               sampled  500/500 (100.0%)  parent_span_id=nil                dsc={}
1   (malformed)                               sampled  500/500 (100.0%)  parent_span_id=nil                dsc={}
--1 (malformed)                               sampled  500/500 (100.0%)  parent_span_id=nil                dsc={}
well-formed, sampled (expected to inherit)    sampled  500/500 (100.0%)  parent_span_id="7c51afd529da4a2a" dsc={}

-0  (malformed)                               sampled    0/500 at traces_sample_rate=1.0
```

With the fix (`return if trace_id.nil?` in `extract_sentry_trace`), the malformed
rows fall back to ~1% with a populated DSC, `-0` is sampled 500/500 at rate 1.0, and
the well-formed row still inherits (500/500).

## Environment

- Ruby: 3.4
- sentry-ruby: 7.2.0
- rack: 3.x

## Notes

- sentry-python (2.73.0) parses `-1` the same way and is sampled 500/500 in the same setup.
- sentry-javascript (`@sentry/core` 11.10.0) ignores it: `propagationContextFromHeaders`
  starts a new trace when the header has no trace ID.
