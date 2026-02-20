import { Injectable, OnModuleInit } from "@nestjs/common";
import { Task, TaskHandler } from "nestjs-graphile-worker";
import { WorkerService } from "nestjs-graphile-worker";
import * as Sentry from "@sentry/nestjs";

/**
 * Case 4: nestjs-graphile-worker
 * Graphile worker tasks run outside HTTP request context on the default isolation scope.
 */
@Injectable()
@Task("background-graphile-task")
export class GraphileJobHandler {
  private taskCount = 0;

  @TaskHandler()
  async handler(payload: { id: number }) {
    this.taskCount++;
    console.log(
      `[nestjs-graphile-worker] Task #${this.taskCount} running`
    );

    Sentry.addBreadcrumb({
      category: "graphile-job",
      message: `Graphile task #${this.taskCount} executed`,
      level: "info",
    });

    console.log(
      `[nestjs-graphile-worker] Task #${this.taskCount} done`
    );
  }
}

/**
 * Service that periodically adds tasks to the graphile-worker queue.
 */
@Injectable()
export class GraphileJobProducer implements OnModuleInit {
  private taskCount = 0;

  constructor(private readonly workerService: WorkerService) {}

  onModuleInit() {
    setInterval(async () => {
      this.taskCount++;
      try {
        await this.workerService.addJob("background-graphile-task", {
          id: this.taskCount,
        });
        console.log(
          `[nestjs-graphile-worker] Added task #${this.taskCount} to queue`
        );
      } catch (e) {
        // Silently ignore if worker service isn't ready
      }
    }, 6000);
  }
}
