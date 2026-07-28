package com.example.myapp;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

import java.io.PrintWriter;
import java.io.StringWriter;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // The Intent extra is unknown to R8, so both Throwable classes remain reachable.
        boolean diagnostic = getIntent().getBooleanExtra("diagnostic", false);
        Throwable throwable = createThrowable(diagnostic);

        String runtimeType = throwable.getClass().getName();
        StringWriter stack = new StringWriter();
        throwable.printStackTrace(new PrintWriter(stack));

        TextView output = new TextView(this);
        output.setText("Requested source type: "
                + (diagnostic ? "DiagnosticTestException" : "ExampleNonFatal")
                + "\nRuntime type: " + runtimeType
                + "\n\n" + stack);
        setContentView(output);
    }

    private static Throwable createThrowable(boolean diagnostic) {
        String message = "example failure";
        if (diagnostic) {
            return new DiagnosticTestException(message);
        }
        return new ExampleNonFatal(message);
    }
}
