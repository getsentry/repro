#!/usr/bin/env node
/**
 * Analyzes the Turbopack build output to detect duplicate @opentelemetry/api
 * module instances — the root cause of sentry-javascript#19367.
 *
 * Turbopack creates per-route entry points. Each route loads different chunks.
 * This script maps which chunks each route loads and checks whether the
 * instrumentation hook and route handlers get different copies of
 * @opentelemetry/api's ContextAPI.
 *
 * Run after `npm run build`:
 *   node scripts/check-otel-dedup.js
 */

const fs = require("fs");
const path = require("path");

const dotNextDir = path.join(__dirname, "../.next");
const serverDir = path.join(dotNextDir, "server");
const chunksDir = path.join(serverDir, "chunks");

if (!fs.existsSync(chunksDir)) {
  console.error("ERROR: .next/server/chunks not found. Run `npm run build` first.");
  process.exit(1);
}

/**
 * Resolve a chunk path from R.c() or e.l() to an absolute filesystem path.
 * R.c() paths are like "server/chunks/foo.js" — relative to .next/
 */
function resolveChunkPath(chunkRef) {
  return path.join(dotNextDir, chunkRef);
}

// 1. Parse the instrumentation entry point
const instrPath = path.join(serverDir, "instrumentation.js");
const instrContent = fs.readFileSync(instrPath, "utf8");

// Static chunks loaded via R.c()
const instrStaticRefs = (instrContent.match(/R\.c\("([^"]+)"\)/g) || [])
  .map(m => m.match(/"([^"]+)"/)[1]);

// Find dynamic chunks inside the static chunk files (loaded via e.l())
let instrDynRefs = [];
for (const ref of instrStaticRefs) {
  const fullPath = resolveChunkPath(ref);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, "utf8");
  const dynMatches = [...content.matchAll(/"(server\/chunks\/[^"]+\.js)"/g)];
  instrDynRefs.push(...dynMatches.map(m => m[1]));
}

const instrAllRefs = [...instrStaticRefs, ...instrDynRefs];
console.log("=== Instrumentation entry point ===");
console.log("Static chunks (R.c):", instrStaticRefs);
console.log("Dynamic chunks (e.l):", instrDynRefs);

// 2. Parse route entry points
const routeFiles = [];
function findRouteFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findRouteFiles(full);
    else if (entry.name === "route.js" || entry.name === "page.js") routeFiles.push(full);
  }
}
findRouteFiles(path.join(serverDir, "app"));

const routes = {};
for (const rf of routeFiles) {
  const content = fs.readFileSync(rf, "utf8");
  const chunks = (content.match(/R\.c\("([^"]+)"\)/g) || []).map(m => m.match(/"([^"]+)"/)[1]);
  const routeName = rf.replace(serverDir + "/app", "").replace(/\/(route|page)\.js$/, "") || "/";
  routes[routeName] = chunks;
}

console.log("\n=== Route entry points ===");
for (const [route, chunks] of Object.entries(routes)) {
  console.log(`${route}: ${chunks.length} chunks`);
}

// 3. Analyze chunks for @opentelemetry/api content
function analyzeChunk(chunkRef) {
  const fullPath = resolveChunkPath(chunkRef);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath, "utf8");
  return {
    ref: chunkRef,
    size: content.length,
    hasOtelSymbol: content.includes('Symbol.for("opentelemetry.js.api'),
    hasContextAPI: content.includes("ContextAPI"),
  };
}

console.log("\n=== @opentelemetry/api duplication analysis ===\n");

// Analyze instrumentation chunks
const instrOtelChunks = [];
for (const ref of instrAllRefs) {
  const analysis = analyzeChunk(ref);
  if (analysis && (analysis.hasOtelSymbol || analysis.hasContextAPI)) {
    instrOtelChunks.push(analysis);
  }
}

if (instrOtelChunks.length > 0) {
  console.log("Instrumentation OTel chunks:");
  for (const c of instrOtelChunks) {
    const shortName = path.basename(c.ref);
    console.log(`  ${shortName} (${(c.size / 1024).toFixed(0)}KB) — Symbol.for: ${c.hasOtelSymbol}, ContextAPI: ${c.hasContextAPI}`);
  }
} else {
  console.log("Instrumentation: no OTel chunks found (may be using externalized modules)");
}

// Analyze route chunks and compare with instrumentation
let hasDuplication = false;
for (const [route, chunks] of Object.entries(routes)) {
  const routeOtelChunks = [];
  for (const ref of chunks) {
    const analysis = analyzeChunk(ref);
    if (analysis && (analysis.hasOtelSymbol || analysis.hasContextAPI)) {
      routeOtelChunks.push(analysis);
    }
  }

  if (routeOtelChunks.length === 0) continue;

  console.log(`\n${route} OTel chunks:`);
  for (const c of routeOtelChunks) {
    const shortName = path.basename(c.ref);
    console.log(`  ${shortName} (${(c.size / 1024).toFixed(0)}KB) — Symbol.for: ${c.hasOtelSymbol}, ContextAPI: ${c.hasContextAPI}`);
  }

  // Check for duplication: does this route load DIFFERENT otel chunks than instrumentation?
  const routeChunkRefs = new Set(routeOtelChunks.map(c => c.ref));
  const instrChunkRefs = new Set(instrOtelChunks.map(c => c.ref));
  const routeOnly = [...routeChunkRefs].filter(r => !instrChunkRefs.has(r));
  const instrOnly = [...instrChunkRefs].filter(r => !routeChunkRefs.has(r));

  if (routeOnly.length > 0 && instrOtelChunks.length > 0) {
    hasDuplication = true;
    console.log(`\n  *** DUPLICATION DETECTED for ${route} ***`);
    console.log(`  Instrumentation-only OTel chunks: ${instrOnly.map(r => path.basename(r)).join(", ")}`);
    console.log(`  Route-only OTel chunks: ${routeOnly.map(r => path.basename(r)).join(", ")}`);
    console.log(`  -> The instrumentation hook and this route load DIFFERENT copies`);
    console.log(`     of @opentelemetry/api. Both register/read via the same global`);
    console.log(`     Symbol.for("opentelemetry.js.api.1"), but they are separate`);
    console.log(`     module instances with separate ContextAPI singletons.`);
  }
}

console.log("\n=== Verdict ===\n");
if (hasDuplication) {
  console.log(
    "BUG CONFIRMED: Turbopack bundled @opentelemetry/api into separate chunks\n" +
    "for the instrumentation hook and route handlers.\n\n" +
    "Root cause chain:\n" +
    "  1. Instrumentation hook loads Sentry SDK → registers SentryContextManager\n" +
    "     via copy A of @opentelemetry/api's registerGlobal()\n" +
    "  2. Route handler loads copy B of @opentelemetry/api with its own ContextAPI\n" +
    "  3. Both copies share the same global Symbol registry, but have separate\n" +
    "     module closures and ContextAPI singletons\n" +
    "  4. In SDK 10.38.0, _startSpan() nests 3 context.with() calls:\n" +
    "       context.with(suppressed) → tracer.startActiveSpan() → context.with(active)\n" +
    "     Each call goes through the global SentryContextManager, which clones\n" +
    "     scopes and re-enters through the async context strategy. With two\n" +
    "     module copies, the re-entry spirals into infinite recursion.\n" +
    "  5. RangeError: Maximum call stack size exceeded\n\n" +
    "This is sentry-javascript#19367.\n\n" +
    "Workaround: add @opentelemetry/api to serverExternalPackages in next.config.js\n" +
    "to force Node.js require() resolution (single instance)."
  );
  process.exit(1);
} else {
  console.log("No cross-entry-point duplication detected.");
}
