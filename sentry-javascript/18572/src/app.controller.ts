import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { context, trace } from '@opentelemetry/api';

interface HeroService {
  findOne(data: { id: number }): Observable<{ id: number; name: string }>;
  findMany(data: { name: string }): Observable<{ heroes: { id: number; name: string }[] }>;
}

@Controller()
export class AppController implements OnModuleInit {
  private heroService: HeroService;

  constructor(@Inject('HERO_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.heroService = this.client.getService<HeroService>('HeroService');
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // This endpoint makes a gRPC call to the same server.
  // Context should propagate from HTTP -> gRPC.
  @Get('test-grpc')
  async testGrpc() {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[app-controller] /test-grpc, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    const hero = await firstValueFrom(this.heroService.findOne({ id: 1 }));
    return { message: 'gRPC call completed', hero };
  }

  // This endpoint makes multiple concurrent gRPC calls.
  // All should be children of the same parent HTTP span.
  // BUG: With SentryContextManager, some of these may lose their parent context.
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
    ]);

    return {
      message: 'Concurrent gRPC calls completed',
      results,
    };
  }
}
