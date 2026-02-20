// Sentry must be imported and initialized before anything else
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  debug: true,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Log all breadcrumbs attached to the error event to show leaking
    const breadcrumbs = event.breadcrumbs || [];
    console.log(
      `\n=== Sentry Event Breadcrumbs (${breadcrumbs.length} total) ===`
    );
    breadcrumbs.forEach((bc, i) => {
      console.log(`  [${i}] category=${bc.category}, message=${bc.message}`);
    });

    // Check for leaked breadcrumbs from other routes
    const leakedFromA = breadcrumbs.filter((b) => b.category === "route-a");
    const leakedFromB = breadcrumbs.filter((b) => b.category === "route-b");
    if (leakedFromA.length > 0 || leakedFromB.length > 0) {
      console.log(
        "\n*** BUG CONFIRMED: Breadcrumbs leaked from other requests! ***"
      );
      console.log(`  - Leaked from route-a: ${leakedFromA.length} breadcrumbs`);
      console.log(`  - Leaked from route-b: ${leakedFromB.length} breadcrumbs`);
    } else {
      console.log("\n  No leaked breadcrumbs detected (isolation working).");
    }
    console.log("=== End Breadcrumbs ===\n");
    return event;
  },
});
