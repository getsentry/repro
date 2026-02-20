import "./instrument";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log("Server running on http://localhost:3000");
  console.log("");
  console.log("To reproduce the breadcrumb leaking issue:");
  console.log(
    "1. Wait ~10 seconds for background jobs to pollute the default scope"
  );
  console.log("2. curl http://localhost:3000/trigger-error");
  console.log("");
  console.log("Background job sources:");
  console.log("  - @nestjs/schedule @Interval (always active)");
  console.log("  - @nestjs/event-emitter @OnEvent (always active)");
  console.log("  - @nestjs/bullmq @Processor (requires REDIS_URL)");
  console.log("  - nestjs-graphile-worker @Task (requires DATABASE_URL)");
}
bootstrap();
