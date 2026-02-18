#!/usr/bin/env node
/**
 * Checks the Next.js build output (.next/server/chunks/) for duplicate
 * @opentelemetry/api module definitions, which is the root cause of the
 * infinite .with() recursion described in sentry-javascript#19367.
 *
 * Run after `npm run build`:
 *   node scripts/check-otel-dedup.js
 */

const fs = require("fs");
const path = require("path");

const chunksDir = path.join(__dirname, "../.next/server/chunks");

if (!fs.existsSync(chunksDir)) {
  console.error(
    "ERROR: .next/server/chunks not found. Run `npm run build` first."
  );
  process.exit(1);
}

const files = fs.readdirSync(chunksDir).filter((f) => f.endsWith(".js"));

const otelChunks = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(chunksDir, file), "utf8");
  // @opentelemetry/api registers itself via a global symbol; look for the module definition
  if (
    content.includes("@opentelemetry/api") &&
    (content.includes("ContextAPI") ||
      content.includes("context._currentContext") ||
      content.includes("Symbol.for(\"opentelemetry.js.api"))
  ) {
    otelChunks.push(file);
  }
}

console.log(`\nScanned ${files.length} server chunks in ${chunksDir}\n`);

if (otelChunks.length === 0) {
  console.log("✓ No @opentelemetry/api module definitions found (may be externalized).");
} else if (otelChunks.length === 1) {
  console.log(
    `✓ @opentelemetry/api appears in exactly 1 chunk: ${otelChunks[0]}`
  );
  console.log("  This is the expected (non-duplicated) state.");
} else {
  console.error(
    `✗ BUG DETECTED: @opentelemetry/api module definition found in ${otelChunks.length} chunks:`
  );
  for (const f of otelChunks) {
    console.error(`    - ${f}`);
  }
  console.error(
    "\n  Two copies of @opentelemetry/api means their .with() methods will\n" +
      "  delegate to each other infinitely → RangeError: Maximum call stack\n" +
      "  size exceeded (sentry-javascript#19367)."
  );
  process.exit(1);
}
