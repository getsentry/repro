const Sentry = require("@sentry/aws-serverless");

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0",
  integrations: [
    Sentry.localVariablesIntegration({ includeOutOfAppFrames: true }),
    Sentry.extraErrorDataIntegration(),
  ],
  includeLocalVariables: true,
  // Try increasing normalizeDepth - the issue reports this doesn't help
  normalizeDepth: 10,
  beforeSend(event) {
    // Inspect the local variables captured in stack frames
    const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
    for (const frame of frames) {
      if (frame.vars && frame.function === "processRequest") {
        console.log("\n--- Local variables captured for processRequest ---");
        console.log(JSON.stringify(frame.vars, null, 2));
      }
    }

    // Also inspect extra data for comparison
    if (event.extra?.payload_debug) {
      console.log("\n--- Same object attached via Sentry.setExtra() ---");
      console.log(JSON.stringify(event.extra.payload_debug, null, 2));
    }

    return event;
  },
});

// Simulate a Lambda-like handler that processes a deeply nested payload
async function processRequest() {
  // Simple (non-nested) local variables for comparison
  const simpleString = "hello world";
  const simpleNumber = 42;
  const flatObject = { key: "value", count: 10 };

  // This is the deeply nested object that should appear in local variables
  const payload = {
    user: {
      id: 123,
      profile: {
        name: "Test User",
        address: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          geo: {
            lat: 39.7817,
            lng: -89.6501,
            metadata: {
              source: "geocoder",
              confidence: 0.95,
              details: {
                provider: "mapbox",
                timestamp: "2024-01-01T00:00:00Z",
              },
            },
          },
        },
      },
    },
    items: [
      {
        id: 1,
        nested: {
          deep: {
            value: "should be visible",
          },
        },
      },
    ],
  };

  // Attach via extra for comparison - this DOES show the full object in Sentry
  Sentry.setExtra("payload_debug", payload);

  // BUG: When this error is captured, the `payload` local variable
  // appears as just {} in Sentry's Local Variables panel,
  // while the same object attached via setExtra() preserves all nesting.
  throw new Error("Test error - check local variables for payload");
}

// Wait for LocalVariables worker thread to initialize before triggering the error
setTimeout(async () => {
  try {
    await processRequest();
  } catch (error) {
    Sentry.captureException(error);
    await Sentry.flush(5000);
    console.log("\n--- Done ---");
    console.log("BUG: payload appears as {} in local variables but is fully preserved in extra data.");
  }
}, 2000);
