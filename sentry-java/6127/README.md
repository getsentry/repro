# Reproduction for sentry-java#6127

**Issue:** https://github.com/getsentry/sentry-java/issues/6127

## Description

The reporter sees a native `SIGSEGV` in ART's JIT thread while it compiles
`okhttp3.internal.connection.RealCall.getResponseWithInterceptorChain()` on Android 14+.
That method is rewritten by the Sentry Android Gradle Plugin (OkHttp auto-instrumentation)
to inject `SentryOkHttpInterceptor`. The release build uses R8 full mode.

Reporter setup (from the [follow-up comment](https://github.com/getsentry/sentry-java/issues/6127#issuecomment-5875794479)):
AGP 8.13.2, R8 full mode, OkHttp 5.3.2, compileSdk 35, Sentry 8.53.0.

This project uses the same setup. It is a minimal app that sends 5,000 concurrent OkHttp
requests (half `execute()`, half `enqueue()`), so `getResponseWithInterceptorChain()` gets hot
and is JIT-compiled.

## Status: NOT reproduced (no physical device used yet)

No crash was triggered. Checks run on Linux x86_64 without a device or emulator (no KVM):

1. **SAGP instrumentation is applied.** In the final dex, `RealCall` (`i0.q`) method `g`
   (`getResponseWithInterceptorChain$okhttp`) contains the injected
   `instanceof SentryOkHttpInterceptor` loop and `new SentryOkHttpInterceptor()`.
2. **The woven JVM bytecode is valid.** The instrumented `RealCall.class` (before R8) passes
   HotSpot's split verifier (`-Xlog:verification`) and its `StackMapTable` frames are consistent.
   Dex files have no StackMapTable at all, so "corrupt StackMapTable frames in the final `.dex`"
   (from the issue analysis) can't happen as described.
3. **ART verifies and compiles the method.** `scripts/art-dex2oat-check.sh` pulls the ART
   module out of the official emulator system images and runs the device's own `dex2oat64
   --compiler-filter=everything` on the release APK. That runs the ART verifier and the
   optimizing compiler (the same backend the JIT uses) on every method:

   | ART build | Result for `i0.q` / `g()` |
   |---|---|
   | Android 15 `AE3A.240806.019` (x86_64) | `(Verified) (AllCompiled)`, 2358 bytes native code, no crash |
   | Android 16 `BE2A.250530.026.D1` (x86_64) | `(Verified) (AllCompiled)`, 2346 bytes native code, no crash |

4. **Consumer rules.** `sentry-okhttp-8.53.0.jar` does ship R8 rules
   (`META-INF/proguard/sentry-okhttp.pro`). The `io.sentry.android.okhttp.*` entries in
   `sentry-android-core`'s rules are stale but harmless (`-dontwarn`/`-keepnames` on a class
   that doesn't exist).

**Not covered:** arm64 codegen (the x86_64 ART build has no arm64 backend, so `dex2oat
--instruction-set=arm64` aborts), updated Play-system (mainline) ART versions, real JIT
profiling/OSR, and vendor ART builds. The next step is to run the APK on a physical
Android 14–16 arm64 device (see below) and compare it with the reporter's exact device
and ART module version.

## Steps to Reproduce

Requires JDK 17 and an Android SDK (`ANDROID_HOME` or `local.properties`).

1. (optional) Set your DSN; it's baked into `BuildConfig` at build time:
   ```bash
   export SENTRY_DSN=
   ```

2. Build the R8 full-mode release APK (signed with the debug key):
   ```bash
   ./gradlew :app:assembleRelease
   ```

3. Install and run it on an Android 14/15/16 **arm64** device, then watch logcat:
   ```bash
   adb install -r app/build/outputs/apk/release/app-release.apk
   adb shell am start -n io.sentry.repro/.MainActivity
   adb logcat -s Repro6127 DEBUG libc art
   ```
   To run the device's optimizing compiler on every method up front (AOT, same backend
   as the JIT), run `adb shell cmd package compile -m everything -f io.sentry.repro`
   and check logcat for a `dex2oat` crash.

4. Offline ART check (Linux x86_64, needs `sudo`, `e2fsprogs`, `python3`):
   ```bash
   ./scripts/art-dex2oat-check.sh 35 app/build/outputs/apk/release/app-release.apk
   ./scripts/art-dex2oat-check.sh 36 app/build/outputs/apk/release/app-release.apk
   ```

## Expected Behavior

All requests finish (`ALL DONE, no crash` in logcat), and Sentry records `http.client` spans.

## Actual Behavior (reported)

The process dies with `SIGSEGV (11)` in the ART JIT thread while it compiles
`RealCall.getResponseWithInterceptorChain()`.

## Environment

- AGP 8.13.2, Gradle 8.14.3, R8 full mode (`android.enableR8.fullMode=true`)
- compileSdk/targetSdk 35, minSdk 24
- OkHttp 5.3.2 (`okhttp-android` variant)
- Sentry Android Gradle Plugin 6.23.0, Sentry SDK 8.53.0 (`sentry-android`, `sentry-okhttp`)
- JDK 17
