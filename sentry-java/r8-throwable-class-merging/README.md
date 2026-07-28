# R8 throwable class merging reproduction

**SDK area:** `sentry-java` / Android exception capture

## Description

This minimal Android app demonstrates how R8 can horizontally merge two custom
`RuntimeException` subclasses. The app asks for an `ExampleNonFatal`, but the
optimized runtime class is the residual class chosen for
`DiagnosticTestException`.

This matters to crash reporters because Java can only observe the optimized
runtime identity through `throwable.getClass().getName()`. Retrace can still
recover an `ExampleNonFatal.<init>` frame from line information, producing an
apparent mismatch between the exception type and constructor frame.

No customer names, code, Sentry DSN, or event data are included.

## Steps to reproduce

1. Install JDK 17 and Android SDK Platform 36.
2. Build the optimized release APK:

   ```bash
   ./gradlew :app:assembleRelease
   ```

3. Inspect the relevant mapping entries:

   ```bash
   grep -n -A20 -E 'DiagnosticTestException|ExampleNonFatal|MainActivity' \
     app/build/outputs/mapping/release/mapping.txt
   ```

4. Install and launch the release APK on a device or emulator:

   ```bash
   adb install -r app/build/outputs/apk/release/app-release-unsigned.apk
   adb shell am start -n com.example.myapp/.MainActivity
   ```

   The default path creates `ExampleNonFatal`. To select the other source type:

   ```bash
   adb shell am start -n com.example.myapp/.MainActivity \
     --ez diagnostic true
   ```

## Expected behavior

For observability, creating `ExampleNonFatal` would preserve a distinct runtime
class identity, allowing a crash reporter to identify it independently from
`DiagnosticTestException`.

## Actual behavior

With AGP 9.2.1 and its bundled R8, the release mapping contains one residual
throwable class:

```text
com.example.myapp.DiagnosticTestException -> a:
```

There is no separate class mapping for `ExampleNonFatal`. Instead, its
constructor is represented as an inlined frame under `MainActivity`:

```text
void com.example.myapp.ExampleNonFatal.<init>(java.lang.String) -> onCreate
```

The default app path therefore displays:

```text
Requested source type: ExampleNonFatal
Runtime type: a
```

A crash reporter records `a` as the raw type. Class-name retracing maps `a` to
`DiagnosticTestException`, while stack retracing can recover the
`ExampleNonFatal.<init>` frame.

## Mitigation

Uncomment this rule in `app/proguard-rules.pro` and rebuild:

```proguard
-keep,allowshrinking,allowobfuscation class * extends java.lang.Throwable
```

This disallows class optimization/merging while still allowing unused
throwables to be removed and retained throwables to be renamed.

## Environment

- Android Gradle Plugin: 9.2.1
- Gradle: 9.4.1
- JDK: 17
- compileSdk / targetSdk: 36
- minSdk: 23
