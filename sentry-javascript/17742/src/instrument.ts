import "dotenv/config";
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  debug: false,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    const breadcrumbs = event.breadcrumbs || [];
    console.log(
      `\n=== Sentry Event Breadcrumbs (${breadcrumbs.length} total) ===`
    );

    // Group breadcrumbs by category
    const categories = new Map<string, number>();
    breadcrumbs.forEach((bc, i) => {
      const cat = bc.category || "unknown";
      categories.set(cat, (categories.get(cat) || 0) + 1);
      console.log(`  [${i}] category=${cat}, message=${bc.message}`);
    });

    // Check for leaked breadcrumbs from each background job type
    const leakCategories = [
      "schedule-job",
      "event-job",
      "bullmq-job",
      "graphile-job",
    ];

    const leaks = leakCategories
      .filter((cat) => categories.has(cat))
      .map((cat) => `${cat}: ${categories.get(cat)}`);

    if (leaks.length > 0) {
      console.log(
        `\n*** BUG CONFIRMED: Breadcrumbs leaked from background jobs! ***`
      );
      console.log(`  Leaked: ${leaks.join(", ")}`);
    } else {
      console.log("\n  No leaked breadcrumbs detected (isolation working).");
    }
    console.log("=== End Breadcrumbs ===\n");
    return event;
  },
});
