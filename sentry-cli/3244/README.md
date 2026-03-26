# Reproduction for sentry-cli#3244

**Issue:** https://github.com/getsentry/sentry-cli/issues/3244

## Description

`sentry-cli sourcemaps inject` fails with `Invalid embedded sourcemap` when a
JavaScript file contains `//# sourceMappingURL=data:application/json;base64,`
inside a string or template literal (e.g. a bundled worker that embeds terser
or babel as a dependency).

The scanner's `discover_sourcemaps_location` function matches the directive
inside the string literal and tries to base64-decode the JavaScript code that
follows, causing the error and an exit code 1 — which also prevents processing
of all other files.

## Steps to Reproduce

Run `sentry-cli sourcemaps inject` on the `dist/` directory:

```bash
sentry-cli sourcemaps inject ./dist
```

## Expected Behavior

The file should be skipped (or processed as having no sourcemap) and the
command should exit successfully.

## Actual Behavior

```
> Searching ./dist
> Found 1 file
> Analyzing 1 sources
> Injecting debug ids
error: Invalid embedded sourcemap in source file ./dist/assets/bundler.worker-CqhnNlN9.js
```

Exit code 1.

## Environment

- sentry-cli: 2.50.2 (reproduced; issue reported against 3.3.3)
- macOS arm64 / Linux x86_64
