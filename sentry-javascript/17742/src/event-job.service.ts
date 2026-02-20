import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OnEvent } from "@nestjs/event-emitter";
import * as Sentry from "@sentry/nestjs";

/**
 * Case 2: @nestjs/event-emitter
 * Event handlers run outside HTTP request context on the default isolation scope.
 */
@Injectable()
export class EventJobService {
  private eventCount = 0;

  constructor(private eventEmitter: EventEmitter2) {
    // Emit events periodically to simulate background event processing
    setInterval(() => {
      this.eventEmitter.emit("background.task", {
        id: Date.now(),
      });
    }, 4000);
  }

  @OnEvent("background.task")
  handleBackgroundEvent(payload: { id: number }) {
    this.eventCount++;
    console.log(`[@nestjs/event-emitter] Event #${this.eventCount} received`);

    Sentry.addBreadcrumb({
      category: "event-job",
      message: `Event handler #${this.eventCount} executed`,
      level: "info",
    });

    console.log(`[@nestjs/event-emitter] Event #${this.eventCount} done`);
  }
}
