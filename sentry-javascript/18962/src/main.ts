// Import this first!
import "./instrument";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 NestJS server running at http://localhost:${port}`);
  console.log(`\n📝 Test streaming: curl http://localhost:${port}/stream`);
  console.log(`   Or open in browser: http://localhost:${port}/stream\n`);
}
bootstrap();
