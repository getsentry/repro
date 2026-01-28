# Reproduction for sentry-javascript#19014

**Issue:** https://github.com/getsentry/sentry-javascript/issues/19014

## Description

When using a custom class that extends `AggregateError` with a different `name` property, Sentry fails to detect it as an exception group. This is because the SDK checks `error.name === "AggregateError"` instead of using `error instanceof AggregateError`.

## Steps to Reproduce

1. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the reproduction:
   ```bash
   npm start
   ```

## Expected Behavior

Both the standard `AggregateError` and the `CustomAggregateError` (which extends `AggregateError`) should be detected as exception groups, with `is_exception_group: true` in the event mechanism.

The "Related Exceptions" section should appear in the Sentry UI for both errors.

## Actual Behavior

- **Standard AggregateError**: Correctly detected as exception group (`is_exception_group: true`)
- **CustomAggregateError**: NOT detected as exception group (`is_exception_group: undefined`)

The console output shows:
```
=== Test 1: Standard AggregateError ===
Exception values:
  [0] type: Error
       is_exception_group: undefined
       parent_id: 0
       exception_id: 2
  [1] type: Error
       is_exception_group: undefined
       parent_id: 0
       exception_id: 1
  [2] type: AggregateError
       is_exception_group: true       ✓ Correct - detected as exception group

=== Test 2: CustomAggregateError ===
Exception values:
  [0] type: Error
       ...
  [4] type: CustomAggregateError
       is_exception_group: undefined  ✗ BUG - not detected as exception group
```

## Root Cause

The issue is in [`packages/core/src/utils/aggregate-errors.ts`](https://github.com/getsentry/sentry-javascript/blob/809d578d7d9281123d474105eaa9952e5fb1a571/packages/core/src/utils/aggregate-errors.ts#L101-L109):

```javascript
// Current implementation checks the name property
if (error.name === 'AggregateError') {
  // ...
}

// Should check instanceof instead
if (error instanceof AggregateError) {
  // ...
}
```

## Environment

- Node.js: v18+
- @sentry/node: 10.27.0
