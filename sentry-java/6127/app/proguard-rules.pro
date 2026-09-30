# Intentionally empty: reproduces the default consumer setup from the issue.
# Reporter's (insufficient) workaround, for reference:
# -keep class io.sentry.okhttp.** { *; }
# -dontwarn io.sentry.okhttp.**
# -keep class okhttp3.internal.connection.RealCall { *; }
