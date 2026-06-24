# Reproduction for sentry-java#5585

**Issue:** https://github.com/getsentry/sentry-java/issues/5585

## Description

`ComposeMaskingOptionsTest > when sentry-unmask modifier is set unmasks the node`
fails intermittently in `:sentry-android-replay:testReleaseUnitTest` with:

```
java.lang.AssertionError: Node with text null should be masked
    at io.sentry.android.replay.viewhierarchy.ComposeMaskingOptionsTest.kt:238
```

This is a flaky test in sentry-java's own unit suite (not an SDK-user-facing bug),
so the "reproduction" is a loop runner that exercises the real test against a
sentry-java checkout until the flake surfaces.

## Key finding

The test passes **100%** of the time when run in isolation, but flakes (~10% in my
runs) when the **whole `ComposeMaskingOptionsTest` class** runs. The flake is
therefore driven by test-interaction / Robolectric layout-timing within the class,
not by anything specific to that single test method.

| How it's run | Result |
| --- | --- |
| Single method only (`--tests "...ComposeMaskingOptionsTest.when sentry-unmask..."`) | 10/10 PASS |
| Whole class (`--tests "...ComposeMaskingOptionsTest"`) | ~1/10 FAIL |

## Steps to Reproduce

```bash
# Point at a local sentry-java checkout (recommended), or omit to clone a fresh one.
export SENTRY_JAVA_DIR=~/workspace/sentry-java
export ITERATIONS=20

./run-repro.sh
```

The script runs the full `ComposeMaskingOptionsTest` class `ITERATIONS` times with
`--rerun-tasks` (Gradle would otherwise cache the passing result and skip re-running)
and prints a PASS/FAIL tally. Because the flake is intermittent, you may need to
rerun to catch it.

## Expected Behavior

The activity-title node is masked when `maskAllText = true`, so the test passes on
every run.

## Actual Behavior

Intermittently the assertion at `ComposeMaskingOptionsTest.kt:238` fails:

```
java.lang.AssertionError: Node with text null should be masked
    at io.sentry.android.replay.viewhierarchy.ComposeMaskingOptionsTest.when sentry-unmask modifier is set unmasks the node(ComposeMaskingOptionsTest.kt:238)
```

## Likely mechanism

In `ComposeViewHierarchyNode.fromComposeNode` (`ComposeViewHierarchyNode.kt:178-189`)
masking is gated on visibility:

```kotlin
val isVisible =
  !SentryLayoutNodeHelper.isTransparent(node) &&
    (semantics == null || !semantics.contains(InvisibleToUser)) &&
    visibleRect.height > 0 && visibleRect.width > 0
...
val shouldMask = isVisible && semantics.shouldMask(isImage = false, options)
```

`visibleRect` comes from `node.coordinates.boundsInWindow(...)`. The failing node is
the activity-title node (its layout is not a `ComposeTextLayout`, hence `text == null`).
When Compose layout/coordinate resolution hasn't fully settled after
`shadowOf(Looper.getMainLooper()).idle()`, `boundsInWindow` returns empty bounds
(`width`/`height == 0`) → `isVisible = false` → the node is not masked even with
`maskAllText = true` → the assertion fails.

## Environment

The flake reproduced here on:

- sentry-java commit `a50df631e0` (main, 2026-06-22)
- JDK 17 (`openjdk 17.0.16`)
- Robolectric, `@Config(sdk = [30])`
- macOS (Darwin 25.5.0)
