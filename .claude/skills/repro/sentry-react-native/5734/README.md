# Reproduction for sentry-react-native#5734

**Issue:** https://github.com/getsentry/sentry-react-native/issues/5734

## Description

When `useNativeInit: true` is set in the Expo config plugin (`app.json`), the SDK stops sending events to sentry.io. Events are visible in Spotlight (local dev tool) but never reach sentry.io.

## Status

**Not yet confirmed on device.** The Android build succeeds and app installs, but full device testing was not completed due to emulator instability. The investigation narrowed the issue to the native side — see Root Cause Analysis below.

## Root Cause Analysis

The JS SDK transport path was **confirmed working** via unit tests — `transport.send()` is called correctly in all `__SENTRY_OPTIONS__` scenarios. The bug is on the **native side**.

When `useNativeInit: true` and `options` are configured in `app.json`:

1. The Expo config plugin generates `sentry.options.json` at prebuild time
2. Native code (`MainApplication`) calls `RNSentrySDK.init(this)` which reads `sentry.options.json` and calls `SentryAndroid.init()` with those options
3. The Metro serializer also injects `__SENTRY_OPTIONS__` into the JS bundle from the same file
4. The JS SDK detects `__SENTRY_OPTIONS__` and sets `autoInitializeNativeSdk = false` — skipping the JS-side `initNativeSdk()` call that normally provides **runtime-computed values**:
   - `defaultSidecarUrl` — spotlight sidecar URL (resolved from Metro dev server host)
   - `devServerUrl` — Metro dev server URL
   - `mobileReplayOptions` — replay masking configuration
5. The native SDK ends up initialized with **incomplete options** from the JSON file

### Suspected trigger: `spotlight: true` without sidecar URL

The `sentry.options.json` contains `"spotlight": true`. Native code enables spotlight but has no `defaultSidecarUrl` — falling back to the native SDK's default (`http://localhost:8969/stream`). On Android emulators, `localhost` points to the emulator itself, not the host machine. This misconfiguration may interfere with the native transport.

### Why events appear in Spotlight but not sentry.io

- **JS Spotlight integration**: Hooks into `beforeEnvelope`, sends via XHR to a properly resolved sidecar URL. Works correctly.
- **Native transport**: `NativeTransport` → `NATIVE.sendEnvelope()` → `RNSentry.captureEnvelope()` → `InternalSentrySdk.captureEnvelope()`. The native SDK may drop events due to misconfigured spotlight or other missing options.

## Steps to Reproduce

### Option 1: Use this standalone reproduction

```bash
cd sentry-react-native/5734
npm install
npx expo prebuild --clean
JAVA_HOME=/path/to/java17 SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:android
```

Edit `App.tsx` to set your DSN, and edit `app.json` options DSN to match.

### Option 2: Use the existing Expo sample in sentry-react-native repo

The `samples/expo/` directory already has `useNativeInit: true` with `spotlight: true` in `app.json`:

```bash
cd sentry-react-native
yarn install && yarn build
cd samples/expo
npx expo prebuild --clean
JAVA_HOME=/path/to/java17 SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:android
```

### Verification steps

1. Send events from the app (tap buttons or trigger errors)
2. Check Spotlight — events should appear
3. Check sentry.io — events may NOT appear (this is the bug)

### Narrowing the root cause

Try these variations to isolate the cause:

**A) Remove `useNativeInit: true`** from `app.json` (keep `options`):
- Re-prebuild and run. If events reach sentry.io, confirms the native pre-init path is the issue.

**B) Remove `"spotlight": true`** from the `options` in `app.json`:
- Delete `sentry.options.json`, re-prebuild and run. If events reach sentry.io, confirms spotlight misconfiguration is the trigger.

**C) Remove all `options`** from `app.json` (keep only `useNativeInit: true`):
- No `sentry.options.json` is generated, no `__SENTRY_OPTIONS__` injected. `autoInitializeNativeSdk` stays `true`. JS re-initializes native with full options. If events reach sentry.io, confirms the issue is `autoInitializeNativeSdk = false` skipping the JS-side init that provides runtime values.

## Expected Behavior

Events should appear on sentry.io within seconds.

## Actual Behavior

Events only appear in Spotlight. They never reach sentry.io.

## Environment
- @sentry/react-native: latest
- Expo SDK: ~52
- React Native: 0.76.x
- Android (emulator or device)
