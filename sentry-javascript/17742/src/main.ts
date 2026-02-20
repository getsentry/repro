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
    "1. Wait ~10 seconds for a few background jobs to run and pollute the default scope"
  );
  console.log("2. curl http://localhost:3000/trigger-error");
  console.log("");
  console.log(
    "Expected: The error event should only contain breadcrumbs from the HTTP request"
  );
  console.log(
    "Actual: The error event also contains breadcrumbs from background jobs"
  );
}
bootstrap();
