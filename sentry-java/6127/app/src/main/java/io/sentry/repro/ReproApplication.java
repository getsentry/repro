package io.sentry.repro;

import android.app.Application;
import io.sentry.android.core.SentryAndroid;

public class ReproApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        SentryAndroid.init(this, options -> {
            options.setDsn(BuildConfig.SENTRY_DSN);
            options.setDebug(true);
            options.setTracesSampleRate(1.0);
        });
    }
}
