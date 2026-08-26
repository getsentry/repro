package io.repro.issue5980

import android.app.Application
import io.sentry.android.core.SentryAndroid

class ReproApplication : Application() {

  override fun onCreate() {
    super.onCreate()

    SentryAndroid.init(this) { options ->
      // Leave the DSN empty unless SENTRY_DSN is exported before the build; the reproduction
      // does not need a working ingest endpoint.
      options.dsn = BuildConfig.SENTRY_DSN
      options.isDebug = false
      // A transaction must be on the scope, otherwise SentrySQLiteStatement records nothing
      // and the instrumentation is effectively a no-op.
      options.tracesSampleRate = 1.0
    }
  }
}
