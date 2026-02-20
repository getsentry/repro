import { DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ScheduleJobService } from "./schedule-job.service";
import { EventJobService } from "./event-job.service";

/**
 * Build imports and providers dynamically based on available services.
 * - Schedule + EventEmitter: always enabled (no external deps)
 * - BullMQ: enabled when REDIS_URL is set
 * - Graphile Worker: enabled when DATABASE_URL is set
 */
function getOptionalImports(): DynamicModule[] {
  const imports: DynamicModule[] = [];

  if (process.env.REDIS_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BullModule } = require("@nestjs/bullmq");
      imports.push(
        BullModule.forRoot({ connection: { url: process.env.REDIS_URL } })
      );
      imports.push(BullModule.registerQueue({ name: "background-queue" }));
      console.log("[Config] BullMQ enabled (REDIS_URL set)");
    } catch (e) {
      console.log("[Config] BullMQ not available");
    }
  } else {
    console.log("[Config] BullMQ disabled (set REDIS_URL to enable)");
  }

  if (process.env.DATABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GraphileWorkerModule } = require("nestjs-graphile-worker");
      imports.push(
        GraphileWorkerModule.forRoot({
          connectionString: process.env.DATABASE_URL,
        })
      );
      console.log("[Config] Graphile Worker enabled (DATABASE_URL set)");
    } catch (e) {
      console.log("[Config] Graphile Worker not available");
    }
  } else {
    console.log("[Config] Graphile Worker disabled (set DATABASE_URL to enable)");
  }

  return imports;
}

function getOptionalProviders(): any[] {
  const providers: any[] = [];

  if (process.env.REDIS_URL) {
    try {
      const { BullmqJobProcessor, BullmqJobProducer } = require("./bullmq-job.processor");
      providers.push(BullmqJobProcessor, BullmqJobProducer);
    } catch (e) {}
  }

  if (process.env.DATABASE_URL) {
    try {
      const { GraphileJobHandler, GraphileJobProducer } = require("./graphile-job.service");
      providers.push(GraphileJobHandler, GraphileJobProducer);
    } catch (e) {}
  }

  return providers;
}

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ...getOptionalImports(),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    AppService,
    ScheduleJobService,
    EventJobService,
    ...getOptionalProviders(),
  ],
})
export class AppModule {}
