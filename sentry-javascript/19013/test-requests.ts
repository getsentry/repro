/**
 * Test script to demonstrate the scope isolation issue
 * Run this after starting the server with: bun run test
 */

async function makeRequest(endpoint: string): Promise<{ endpoint: string; traceId: string }> {
  const response = await fetch(`http://localhost:3000${endpoint}`);
  const data = await response.json();
  return data as { endpoint: string; traceId: string };
}

async function runTest() {
  console.log("Testing Sentry Bun + Express scope isolation...\n");

  try {
    // Make sequential requests to different endpoints
    const results = [];

    for (let i = 0; i < 3; i++) {
      const result1 = await makeRequest("/endpoint1");
      results.push(result1);

      const result2 = await makeRequest("/endpoint2");
      results.push(result2);
    }

    console.log("\n=== Results ===\n");

    const traceIds = new Set<string>();
    results.forEach((result, index) => {
      console.log(`Request ${index + 1}: ${result.endpoint} -> Trace ID: ${result.traceId}`);
      if (result.traceId && result.traceId !== "NO TRACE ID") {
        traceIds.add(result.traceId);
      }
    });

    console.log("\n=== Summary ===\n");
    console.log(`Total requests: ${results.length}`);
    console.log(`Unique trace IDs: ${traceIds.size}`);

    if (traceIds.size === 0) {
      console.log("\n❌ BUG: No trace IDs were generated at all");
    } else if (traceIds.size < results.length) {
      console.log("\n❌ BUG CONFIRMED: Multiple requests share the same trace ID!");
      console.log("   Expected: Each request should have a unique trace ID");
      console.log("   Actual: Requests are sharing trace IDs (missing scope isolation)");
    } else {
      console.log("\n✅ Working correctly: Each request has a unique trace ID");
    }
  } catch (error) {
    console.error("Error making requests. Is the server running?");
    console.error("Start the server first with: bun run start");
    console.error(error);
  }
}

runTest();
