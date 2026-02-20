import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import * as Sentry from "@sentry/nestjs";

/**
 * Simulates a background job runner (like graphile-worker or BullMQ).
 * These jobs run outside the HTTP request context, so they execute on the
 * default isolation scope. Any breadcrumbs they add pollute the default scope,
 * which then gets cloned into every new HTTP request's isolation scope.
 */
@Injectable()
export class BackgroundJobService {
  private jobCount = 0;

  @Interval(3000)
  handleBackgroundJob() {
    this.jobCount++;
    console.log(`[Background Job #${this.jobCount}] Running...`);

    // These breadcrumbs are added to the default isolation scope
    // because this code runs outside any HTTP request context
    Sentry.addBreadcrumb({
      category: "background-job",
      message: `Background job #${this.jobCount} started`,
      level: "info",
    });
    Sentry.addBreadcrumb({
      category: "background-job",
      message: `Background job #${this.jobCount} completed`,
      level: "info",
    });

    console.log(
      `[Background Job #${this.jobCount}] Done — 2 breadcrumbs added to default scope`
    );
  }
}
