import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

@Injectable()
export class AppService {
  handleRouteA(): string {
    // Add distinctive breadcrumbs for route A
    Sentry.addBreadcrumb({
      category: "route-a",
      message: "Processing route A - step 1",
      level: "info",
    });
    Sentry.addBreadcrumb({
      category: "route-a",
      message: "Processing route A - step 2",
      level: "info",
    });
    Sentry.addBreadcrumb({
      category: "route-a",
      message: "Route A completed successfully",
      level: "info",
    });

    console.log("[Route A] Request handled, 3 breadcrumbs added");
    return "Route A OK";
  }

  handleRouteB(): string {
    // Add distinctive breadcrumbs for route B
    Sentry.addBreadcrumb({
      category: "route-b",
      message: "Processing route B - step 1",
      level: "info",
    });
    Sentry.addBreadcrumb({
      category: "route-b",
      message: "Route B completed successfully",
      level: "info",
    });

    console.log("[Route B] Request handled, 2 breadcrumbs added");
    return "Route B OK";
  }

  triggerError(): string {
    // Add a breadcrumb specific to this request
    Sentry.addBreadcrumb({
      category: "trigger-error",
      message: "About to trigger an error",
      level: "error",
    });

    // Throw an exception — the SentryGlobalFilter will capture it automatically.
    // Check the Sentry event to see if breadcrumbs from route-a and route-b
    // leaked into this event.
    // EXPECTED: Only the "trigger-error" breadcrumb should appear
    // ACTUAL (BUG): Breadcrumbs from route-a and route-b may also appear
    throw new Error("Test error to check breadcrumb isolation");
  }
}
