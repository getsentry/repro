import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { context, trace } from '@opentelemetry/api';

interface HeroService {
  findOne(data: { id: number }): Observable<{ id: number; name: string }>;
  findMany(data: { name: string }): Observable<{ heroes: { id: number; name: string }[] }>;
}

interface VillainService {
  findOne(data: { id: number }): Observable<{ id: number; name: string }>;
  findMany(data: { name: string }): Observable<{ villains: { id: number; name: string }[] }>;
}

@Controller()
export class AppController implements OnModuleInit {
  private heroService: HeroService;
  private villainService: VillainService;

  constructor(
    @Inject('HERO_PACKAGE') private heroClient: ClientGrpc,
    @Inject('VILLAIN_PACKAGE') private villainClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.heroService = this.heroClient.getService<HeroService>('HeroService');
    this.villainService = this.villainClient.getService<VillainService>('VillainService');
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('test-grpc')
  async testGrpc() {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[app-controller] /test-grpc, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    const hero = await firstValueFrom(this.heroService.findOne({ id: 1 }));
    return { message: 'gRPC call completed', hero };
  }

  // Makes concurrent gRPC calls to BOTH services on different ports.
  // All should be children of the same parent HTTP span.
  @Get('test-concurrent')
  async testConcurrent() {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[app-controller] /test-concurrent, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    const results = await Promise.all([
      firstValueFrom(this.heroService.findOne({ id: 1 })),
      firstValueFrom(this.heroService.findOne({ id: 2 })),
      firstValueFrom(this.heroService.findMany({ name: 'man' })),
      firstValueFrom(this.villainService.findOne({ id: 1 })),
      firstValueFrom(this.villainService.findOne({ id: 2 })),
      firstValueFrom(this.villainService.findMany({ name: 'o' })),
    ]);

    return {
      message: 'Concurrent gRPC calls to both services completed',
      results,
    };
  }

  // Cross-service calls: hero handler calls villain service and vice versa,
  // simulating real microservice interactions across service boundaries.
  @Get('test-cross-service')
  async testCrossService() {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[app-controller] /test-cross-service, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    // Sequential cross-service calls to test context propagation depth
    const hero = await firstValueFrom(this.heroService.findOne({ id: 1 }));
    const villain = await firstValueFrom(this.villainService.findOne({ id: 1 }));

    // Then concurrent calls across both services
    const [heroes, villains] = await Promise.all([
      firstValueFrom(this.heroService.findMany({ name: 'man' })),
      firstValueFrom(this.villainService.findMany({ name: 'o' })),
    ]);

    return {
      message: 'Cross-service calls completed',
      hero,
      villain,
      heroes,
      villains,
    };
  }
}
