# Reproduction for getsentry/sentry-react-native#5508

**Issue:** https://github.com/getsentry/sentry-react-native/issues/5508

## Description

Events are silently dropped when `Sentry.init()` is the first statement after an early return guard in a function, in **production builds only**. Adding any statement (e.g., `console.log('test')`) before `Sentry.init()` fixes the issue.

> **Note:** This bug only manifests in production builds with Hermes bytecode compilation. It **cannot** be reproduced in development mode (`npx expo start`). You need an actual EAS Build or a production release build.

## Prerequisites

- Node.js 22+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) and an Expo account (`eas login`)
- A Sentry project with a DSN
- An Android device or emulator (for APK testing)

## Steps to Reproduce

### 1. Install dependencies

```bash
cd sentry-react-native/5508
npm install
```

### 2. Configure your Sentry DSN

```bash
export SENTRY_DSN="https://your-key@sentry.io/your-project-id"
```

Edit `app.json` and replace `YOUR_SENTRY_DSN_HERE` with your actual DSN.

### 3. Build a production APK (Android)

```bash
npx expo prebuild --clean
cd android && ./gradlew assembleRelease && cd ..
```

Or use EAS Build:

```bash
eas build --profile preview --platform android --local
```

### 4. Install and test

Install the APK on a device/emulator and:

1. Tap **"Send Test Event (BUG: may be dropped)"** - this uses the buggy code path where `Sentry.init()` is the first statement after the early return guard
2. Check your Sentry dashboard - **events may NOT appear**
3. Now restart the app and tap **"Send Test Event (WORKAROUND: works)"** - this uses the workaround with a statement before `Sentry.init()`
4. Check your Sentry dashboard - **events SHOULD appear**

## Expected Behavior

Both buttons should successfully send events to Sentry.

## Actual Behavior

The first button (without workaround) silently drops events in production builds. The second button (with `console.log` before `Sentry.init()`) works correctly.

## Environment

- React Native: 0.81.5 (via Expo SDK 53)
- @sentry/react-native: 7.8.0
- Hermes: enabled
- New Architecture: enabled
- Platform: Android (also reported on iOS)

## Analysis

See the issue for detailed analysis. The suspected root causes are:

1. **`RNSentry` native module resolution at module load time** (`wrapper.ts:48`) - resolved once as a top-level `const`, never retried if initially `undefined`
2. **Hermes bytecode optimization** - may incorrectly optimize the code pattern of early-return-guard followed immediately by a function call
3. **`__SENTRY_OPTIONS__` production-only code path** (`sdk.tsx:147`) - only active when `!__DEV__`, may interfere with native SDK initialization

The workaround is to add any statement before `Sentry.init()`:
```js
console.log('[Sentry] initializing...'); // <-- adding this fixes the issue
Sentry.init({ ... });
```
