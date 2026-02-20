import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import * as Sentry from "@sentry/nestjs";

/**
 * Case 3: @nestjs/bullmq
 * BullMQ processors run outside HTTP request context on the default isolation scope.
 */
@Processor("background-queue")
export class BullmqJobProcessor extends WorkerHost {
  private jobCount = 0;

  async process(job: Job): Promise<void> {
    this.jobCount++;
    console.log(
      `[@nestjs/bullmq] Processing job #${this.jobCount}: ${job.name}`
    );

    Sentry.addBreadcrumb({
      category: "bullmq-job",
      message: `BullMQ job #${this.jobCount} processed`,
      level: "info",
    });

    console.log(`[@nestjs/bullmq] Job #${this.jobCount} done`);
  }
}

/**
 * Service that periodically adds jobs to the BullMQ queue.
 */
@Injectable()
export class BullmqJobProducer implements OnModuleInit {
  private jobCount = 0;

  constructor(@InjectQueue("background-queue") private queue: Queue) {}

  onModuleInit() {
    setInterval(async () => {
      this.jobCount++;
      await this.queue.add("background-task", {
        id: this.jobCount,
      });
      console.log(`[@nestjs/bullmq] Added job #${this.jobCount} to queue`);
    }, 5000);
  }
}
