package com.example.camerareplayrepro

import android.app.Application
import io.sentry.android.core.SentryAndroid

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        SentryAndroid.init(this) { options ->
            // Set your DSN or use environment variable SENTRY_DSN
            options.dsn = System.getenv("SENTRY_DSN") ?: ""

            // Enable Session Replay with 100% sample rate for testing
            options.sessionReplay.sessionSampleRate = 1.0
            options.sessionReplay.onErrorSampleRate = 1.0

            // Enable debug logging to see what's happening
            options.isDebug = true
        }
    }
}
