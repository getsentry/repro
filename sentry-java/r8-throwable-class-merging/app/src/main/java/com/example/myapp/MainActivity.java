package com.example.myapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.widget.TextView;

public final class MainActivity extends Activity {

    private static final String TAG = "MainActivity";

    @SuppressLint("SetTextI18n")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final State loading = State.Loading.INSTANCE;
        final State error = State.Error.INSTANCE;
        final State success = new State.Success("Hello World");

        try {
            loading.goNuts();
        } catch (Exception e) {
            Log.d(TAG, "loading", e);
        }
        try {
            error.goNuts();
        } catch (Exception e) {
            Log.d(TAG, "error", e);
        }
        try {
            success.goNuts();
        } catch (Exception e) {
            Log.d(TAG, "success", e);
        }
        final TextView output = new TextView(this);
        output.setPadding(72, 72, 72, 72);
        output.setText(
                "loading: " + loading.getClass() + "\n" +
                "error: " + error.getClass() + "\n" +
                "success: " + success.getClass());
        setContentView(output);
    }
}
