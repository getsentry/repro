#!/usr/bin/env node
/**
 * Force-reproduces the infinite .with() recursion from sentry-javascript#19367.
 *
 * In the real Turbopack build, there are two separate ContextAPI singleton instances
 * (one from the Turbopack ESM bundle, one from the CJS bundle within the same chunk).
 * Both share the same global context manager via Symbol.for("opentelemetry.js.api.1").
 *
 * This script simulates that duplication by loading @opentelemetry/api twice
 * (clearing the require cache to get separate singletons) and exercising the
 * context.with() path the way @sentry/opentelemetry's _startSpan() does.
 */

const Module = require("module");
const path = require("path");

// --- Load copy A of @opentelemetry/api ---
const apiA = require("@opentelemetry/api");
const contextA = apiA.context;

console.log("Copy A loaded. ContextAPI instance:", contextA.constructor.name);

// --- Force a second load by clearing require cache for all @opentelemetry/api modules ---
const otelApiDir = path.dirname(require.resolve("@opentelemetry/api"));
for (const key of Object.keys(require.cache)) {
  if (key.includes("@opentelemetry/api")) {
    delete require.cache[key];
  }
}

// Also clear the ContextAPI singleton (it's stored as a static property)
// In the real Turbopack scenario, each chunk creates its own singleton
const apiB = require("@opentelemetry/api");
const contextB = apiB.context;

console.log("Copy B loaded. ContextAPI instance:", contextB.constructor.name);
console.log("Same instance?", contextA === contextB); // Should be false

// --- Set up the Sentry-like context manager (shared via global) ---
// Import the real SentryContextManager from @sentry/node-core if available
let SentryContextManager;
try {
  const { AsyncLocalStorageContextManager } = require("@opentelemetry/context-async-hooks");
  const { wrapContextManagerClass } = require("@sentry/opentelemetry");
  SentryContextManager = wrapContextManagerClass(AsyncLocalStorageContextManager);
} catch (e) {
  console.log("Could not load SentryContextManager, using basic setup:", e.message);
  process.exit(1);
}

// Register via copy A (like the instrumentation hook does)
const mgr = new SentryContextManager();
mgr.enable();
contextA.setGlobalContextManager(mgr);
console.log("Registered SentryContextManager via copy A");

// --- Now simulate what _startSpan() does ---
// This calls context.with() from BOTH copies in a nested fashion,
// just like the Turbopack bundle does when the instrumentation hook's
// @sentry/opentelemetry calls context.with() and the route handler's
// @opentelemetry/api also calls context.with().

console.log("\n--- Test 1: Single context.with() via copy A ---");
try {
  contextA.with(contextA.active(), () => "ok from A");
  console.log("✓ Passed");
} catch (e) {
  console.log("✗ CRASH:", e.message);
}

console.log("\n--- Test 2: Single context.with() via copy B ---");
try {
  contextB.with(contextB.active(), () => "ok from B");
  console.log("✓ Passed");
} catch (e) {
  console.log("✗ CRASH:", e.message);
}

console.log("\n--- Test 3: Nested A → B (simulates _startSpan with two module copies) ---");
try {
  contextA.with(contextA.active(), () => {
    return contextB.with(contextB.active(), () => {
      return "ok nested A→B";
    });
  });
  console.log("✓ Passed");
} catch (e) {
  console.log("✗ CRASH:", e.message);
}

console.log("\n--- Test 4: Deep nesting A→B→A→B (simulates startSpan + withScope chains) ---");
try {
  contextA.with(contextA.active(), () => {
    return contextB.with(contextB.active(), () => {
      return contextA.with(contextA.active(), () => {
        return contextB.with(contextB.active(), () => {
          return "ok deep nesting";
        });
      });
    });
  });
  console.log("✓ Passed");
} catch (e) {
  console.log("✗ CRASH:", e.message);
}

console.log("\n--- Test 5: Using @sentry/opentelemetry's actual startSpan from both copies ---");
try {
  const Sentry = require("@sentry/node");
  Sentry.startSpan({ name: "outer" }, () => {
    return Sentry.startSpan({ name: "inner" }, () => {
      // This nesting is what happens in the real scenario
      return contextB.with(contextB.active(), () => {
        return Sentry.startSpan({ name: "deepest" }, () => {
          return "ok from nested Sentry spans with copy B";
        });
      });
    });
  });
  console.log("✓ Passed");
} catch (e) {
  console.log("✗ CRASH:", e.message);
}

console.log("\n--- Test 6: Rapid concurrent context.with() from both copies ---");
let crashes = 0;
let successes = 0;
const promises = [];
for (let i = 0; i < 1000; i++) {
  promises.push(
    new Promise((resolve) => {
      try {
        const ctx = i % 2 === 0 ? contextA : contextB;
        const otherCtx = i % 2 === 0 ? contextB : contextA;
        ctx.with(ctx.active(), () => {
          return otherCtx.with(otherCtx.active(), () => {
            successes++;
            resolve();
          });
        });
      } catch (e) {
        crashes++;
        resolve();
      }
    })
  );
}
Promise.all(promises).then(() => {
  console.log(`Results: ${successes} successes, ${crashes} crashes`);
  if (crashes > 0) {
    console.log("✗ Concurrent context.with() caused crashes!");
  } else {
    console.log("✓ No crashes in concurrent test");
  }

  console.log("\nDone. If no crash occurred, the recursion may require");
  console.log("additional factors: specific instrumentation chains,");
  console.log("Node.js v24 behavior, or sustained production traffic patterns.");
});
