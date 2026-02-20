import "dotenv/config";
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  debug: true,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Log all breadcrumbs attached to the error event
    const breadcrumbs = event.breadcrumbs || [];
    console.log(
      `\n=== Sentry Event Breadcrumbs (${breadcrumbs.length} total) ===`
    );
    breadcrumbs.forEach((bc, i) => {
      console.log(`  [${i}] category=${bc.category}, message=${bc.message}`);
    });

    // Check for leaked breadcrumbs from background jobs
    const leaked = breadcrumbs.filter((b) => b.category === "background-job");
    if (leaked.length > 0) {
      console.log(
        `\n*** BUG CONFIRMED: ${leaked.length} breadcrumbs leaked from background jobs! ***`
      );
    } else {
      console.log("\n  No leaked breadcrumbs detected (isolation working).");
    }
    console.log("=== End Breadcrumbs ===\n");
    return event;
  },
});
