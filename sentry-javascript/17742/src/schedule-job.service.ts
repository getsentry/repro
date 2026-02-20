import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import * as Sentry from "@sentry/nestjs";

/**
 * Case 1: @nestjs/schedule
 * Scheduled jobs run outside HTTP request context on the default isolation scope.
 */
@Injectable()
export class ScheduleJobService {
  private jobCount = 0;

  @Interval(3000)
  handleScheduledJob() {
    this.jobCount++;
    console.log(`[@nestjs/schedule] Job #${this.jobCount} running`);

    Sentry.addBreadcrumb({
      category: "schedule-job",
      message: `Scheduled job #${this.jobCount} executed`,
      level: "info",
    });

    console.log(`[@nestjs/schedule] Job #${this.jobCount} done`);
  }
}
