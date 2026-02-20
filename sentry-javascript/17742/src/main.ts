import "./instrument";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log("Server running on http://localhost:3000");
  console.log("");
  console.log("To reproduce the breadcrumb leaking issue:");
  console.log("1. curl http://localhost:3000/route-a");
  console.log("2. Wait a moment, then: curl http://localhost:3000/route-b");
  console.log("3. curl http://localhost:3000/trigger-error");
  console.log("");
  console.log(
    "Expected: The error event should only contain breadcrumbs from /trigger-error"
  );
  console.log(
    "Actual: The error event may contain breadcrumbs from /route-a and /route-b as well"
  );
}
bootstrap();
