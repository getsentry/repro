package io.sentry.repro;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.widget.TextView;
import io.sentry.ITransaction;
import io.sentry.Sentry;
import io.sentry.TransactionOptions;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/**
 * Fires lots of concurrent OkHttp calls so RealCall.getResponseWithInterceptorChain()
 * (which the Sentry Gradle plugin rewrites to inject SentryOkHttpInterceptor) gets hot
 * and is JIT-compiled by ART.
 *
 * Expected: all requests complete, Sentry records http.client spans.
 * Reported (getsentry/sentry-java#6127): SIGSEGV in the ART JIT thread while compiling
 * RealCall.getResponseWithInterceptorChain() on Android 14+.
 */
public class MainActivity extends Activity {
    private static final String TAG = "Repro6127";
    private static final int TOTAL_REQUESTS = 5_000;

    private final OkHttpClient client = new OkHttpClient();
    private final ExecutorService pool = Executors.newFixedThreadPool(16);
    private final AtomicInteger done = new AtomicInteger();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView tv = new TextView(this);
        tv.setText("Firing " + TOTAL_REQUESTS + " requests, watch logcat (tag " + TAG + ")");
        setContentView(tv);

        TransactionOptions txOptions = new TransactionOptions();
        txOptions.setBindToScope(true);
        ITransaction tx = Sentry.startTransaction("repro-6127", "ui.load", txOptions);
        Request request = new Request.Builder().url("https://httpbin.org/status/200").build();

        for (int i = 0; i < TOTAL_REQUESTS; i++) {
            // mix sync (execute) and async (enqueue) paths; both go through
            // getResponseWithInterceptorChain()
            if (i % 2 == 0) {
                pool.execute(() -> {
                    try (Response r = client.newCall(request).execute()) {
                        progress(tx, r.code());
                    } catch (IOException e) {
                        progress(tx, -1);
                    }
                });
            } else {
                client.newCall(request).enqueue(new Callback() {
                    @Override public void onFailure(Call call, IOException e) { progress(tx, -1); }
                    @Override public void onResponse(Call call, Response r) { r.close(); progress(tx, r.code()); }
                });
            }
        }
    }

    private void progress(ITransaction tx, int code) {
        int n = done.incrementAndGet();
        if (n % 250 == 0) Log.i(TAG, "completed " + n + "/" + TOTAL_REQUESTS + " (last=" + code + ")");
        if (n == TOTAL_REQUESTS) {
            tx.finish();
            Log.i(TAG, "ALL DONE, no crash");
        }
    }
}
