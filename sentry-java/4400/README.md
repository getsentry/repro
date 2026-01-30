# Reproduction for sentry-java#4400

**Issue:** https://github.com/getsentry/sentry-java/issues/4400

## Description

This reproduction demonstrates the issue where CameraX preview content may not be properly masked in Sentry Session Replay. When using `androidx.camera.view.PreviewView` to display the camera feed, the content should be masked in replays to protect user privacy, but it may be visible instead.

## Steps to Reproduce

1. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN="your-dsn-here"
   ```

2. Build and install the app:
   ```bash
   ./gradlew installDebug
   ```

3. Launch the app on a physical device (emulator camera may not work properly)

4. Grant camera permission when prompted

5. Once the camera preview is showing, tap either:
   - **"Capture Error (Non-Fatal)"** - captures an exception and triggers replay upload
   - **"Trigger Fatal Crash"** - causes a fatal crash while camera is active

6. View the replay in Sentry

## Expected Behavior

- The CameraX `PreviewView` content should be masked/blacked out in the Session Replay
- User's camera feed should NOT be visible in Sentry
- This is critical for user privacy

## Actual Behavior (Reported)

- Camera preview content may be visible in the replay
- The `PreviewView` class from CameraX is not automatically masked

## Notes

- The issue was originally reported with Camera Intents, but those actually cannot be captured since the camera app runs in a different process
- The real issue appears to be with CameraX (`androidx.camera.view.PreviewView`)
- Issue was reproduced in MAUI using [CameraScanner.Maui](https://github.com/thomasgalliker/CameraScanner.Maui) which uses androidx.camera under the hood

## Environment

- Sentry Android SDK: 8.11.1
- CameraX: 1.3.4
- AGP: 8.7.3
- Min SDK: 24
- Target SDK: 34

## Project Structure

```
├── app/
│   ├── build.gradle.kts       # Dependencies including Sentry 8.11.1 and CameraX
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/.../
│       │   ├── MyApplication.kt   # Sentry initialization with Session Replay
│       │   └── MainActivity.kt    # CameraX preview setup
│       └── res/
│           └── layout/activity_main.xml  # PreviewView layout
├── build.gradle.kts
└── settings.gradle.kts
```
