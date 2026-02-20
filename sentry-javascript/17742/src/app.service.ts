import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

@Injectable()
export class AppService {
  triggerError(): string {
    // Add a breadcrumb specific to this HTTP request
    Sentry.addBreadcrumb({
      category: "http-request",
      message: "About to trigger an error in HTTP handler",
      level: "error",
    });

    // Throw an exception — the SentryGlobalFilter captures it automatically.
    // EXPECTED: Only the "http-request" breadcrumb should appear on the event
    // ACTUAL (BUG): Breadcrumbs from background jobs leak into this event
    //   because the HTTP request's isolation scope was cloned from the default
    //   scope, which was polluted by background job breadcrumbs
    throw new Error("Test error to check breadcrumb isolation");
  }
}
