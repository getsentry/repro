# Reproduction for sentry-react-native#5561

**Issue:** https://github.com/getsentry/sentry-react-native/issues/5561

## Description

This reproduction demonstrates excessive `getRandomValues` calls when making fetch requests in a React Native app with Sentry tracing enabled. The issue reports ~90 calls to `getRandomValues` per HTTP request, which is excessive compared to the expected 2-3 spans created per request.

The root cause appears to be in the default parameter evaluation of `generateSentryTraceHeader` and `generateTraceparentHeader` functions in `@sentry/core/build/esm/utils/tracing.js`:

```javascript
function generateSentryTraceHeader(
  traceId = generateTraceId(),  // ⚠️ Evaluated every time, even when traceId is passed
  spanId = generateSpanId(),    // ⚠️ Evaluated every time, even when spanId is passed
  sampled,
) {
  // ...
}
```

## Environment

- React Native: 0.81.5
- @sentry/react-native: 7.2.0
- react-native-get-random-values: 2.0.0
- Node.js: 24.10.0 (or compatible)
- Hermes: Enabled
- New Architecture: Enabled

## Steps to Reproduce

### Prerequisites

This reproduction requires a full React Native environment setup. If you don't have one ready:
- Follow the [React Native Environment Setup guide](https://reactnative.dev/docs/environment-setup)
- Ensure you have Xcode (for iOS) or Android Studio (for Android) installed
- Have CocoaPods installed for iOS development

### Running the Reproduction

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

2. Initialize the React Native project structure (if not already present):
   ```bash
   npx @react-native-community/cli init SentryReproApp --directory . --skip-install
   ```

3. Install iOS pods (iOS only):
   ```bash
   cd ios && pod install && cd ..
   ```

4. Run the app:
   ```bash
   # For iOS
   npm run ios
   # or
   yarn ios

   # For Android
   npm run android
   # or
   yarn android
   ```

4. Once the app launches:
   - Observe the initial `getRandomValues` call count (displayed in the app)
   - Click the "Make HTTP Request" button
   - Check the console logs for detailed call counts
   - Observe the number of calls made during the single fetch request

5. Check Metro bundler console or React Native debugger for logs like:
   ```
   [Test] Starting fetch request. Current getRandomValues calls: X
   [getRandomValues] Call #X+1
   [getRandomValues] Call #X+2
   ...
   [getRandomValues] Call #X+90
   [Test] Fetch completed. getRandomValues calls during this request: ~90
   ```

## Expected Behavior

Each fetch request should generate ~2-5 calls to `getRandomValues`:
- 1 call for transaction/trace ID
- 1 call for parent span ID
- 1-2 calls for child span IDs (e.g., http.client span)
- Maybe 1-2 additional calls for internal span management

Total: ~2-5 calls per request

## Actual Behavior

Each fetch request generates ~90+ calls to `getRandomValues`, which is approximately 18-45x more than expected. This causes performance concerns, especially in apps with frequent network requests.

## Notes

- The reproduction includes a monkey-patched `crypto.getRandomValues` to count and log all calls
- The counter displays in real-time in the app UI
- Console logs show the exact number of calls per request
- The issue persists even with an empty DSN (tracing is still active)
- Disabling Sentry completely eliminates the excessive calls

## Alternative: Create from Scratch

If you prefer to start fresh with the official React Native CLI:

```bash
# Create a new React Native project
npx @react-native-community/cli@latest init TestProject --version 0.81.5

# Install Sentry
cd TestProject
npm install @sentry/react-native@7.2.0 react-native-get-random-values@2.0.0

# Replace App.tsx and index.js with the files from this reproduction
# Then follow steps 3-5 above
```

## Environment Variables

You can optionally set a Sentry DSN to see the traces in the Sentry UI:

```bash
export SENTRY_DSN="your-dsn-here"
```

However, the issue reproduces with an empty DSN as well since the tracing instrumentation is still active.

## Testing Status

⚠️ **Note**: This reproduction requires a full React Native environment with native iOS or Android setup. The issue cannot be easily reproduced in a Node.js-only environment due to React Native's native dependencies.

To test this reproduction:
1. Set up a React Native development environment
2. Initialize the native project structure
3. Run on an iOS simulator or Android emulator
4. Observe the excessive `getRandomValues` calls in the Metro console
