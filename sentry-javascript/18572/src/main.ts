import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create a hybrid app: HTTP + gRPC
  const app = await NestFactory.create(AppModule);

  // Connect gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'hero',
      protoPath: join(__dirname, 'hero.proto'),
      url: '0.0.0.0:5001',
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);

  console.log('[main] HTTP server listening on http://localhost:3000');
  console.log('[main] gRPC server listening on 0.0.0.0:5001');
  console.log('[main] Hit endpoints to test context propagation:');
  console.log('[main]   GET http://localhost:3000/test-grpc');
  console.log('[main]   GET http://localhost:3000/test-concurrent');
}

bootstrap();
