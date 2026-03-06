import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppController } from './app.controller';
import { HeroController } from './hero.controller';
import { VillainController } from './villain.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'HERO_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'hero',
          protoPath: join(__dirname, 'hero.proto'),
          url: 'localhost:5001',
          loader: { defaults: true },
        },
      },
      {
        name: 'VILLAIN_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'villain',
          protoPath: join(__dirname, 'villain.proto'),
          url: 'localhost:5002',
          loader: { defaults: true },
        },
      },
    ]),
  ],
  controllers: [AppController, HeroController, VillainController],
})
export class AppModule {}
