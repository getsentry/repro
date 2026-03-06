import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Connect two gRPC microservices on separate ports, matching the reporter's setup
  // where they run internal + external gRPC servers on the same NestJS hybrid app.
  const grpcServices: MicroserviceOptions[] = [
    {
      transport: Transport.GRPC,
      options: {
        package: 'hero',
        protoPath: join(__dirname, 'hero.proto'),
        url: '0.0.0.0:5001',
        loader: { defaults: true },
      },
    },
    {
      transport: Transport.GRPC,
      options: {
        package: 'villain',
        protoPath: join(__dirname, 'villain.proto'),
        url: '0.0.0.0:5002',
        loader: { defaults: true },
      },
    },
  ];

  for (const serviceOptions of grpcServices) {
    app.connectMicroservice(serviceOptions, {
      inheritAppConfig: false,
    });
  }

  await app.startAllMicroservices();
  await app.listen(3000);

  console.log('[main] HTTP server listening on http://localhost:3000');
  console.log('[main] gRPC hero service listening on 0.0.0.0:5001');
  console.log('[main] gRPC villain service listening on 0.0.0.0:5002');
  console.log('[main] Hit endpoints to test context propagation:');
  console.log('[main]   GET http://localhost:3000/test-grpc');
  console.log('[main]   GET http://localhost:3000/test-concurrent');
  console.log('[main]   GET http://localhost:3000/test-cross-service');
}

bootstrap();
