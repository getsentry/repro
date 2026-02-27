import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { context, trace } from '@opentelemetry/api';

// Simulated data
const heroes = [
  { id: 1, name: 'Superman' },
  { id: 2, name: 'Batman' },
  { id: 3, name: 'Wonder Woman' },
];

@Controller()
export class HeroController {
  @GrpcMethod('HeroService', 'FindOne')
  async findOne(data: { id: number }) {
    // Simulate some async work that should preserve context
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[hero-controller] FindOne called, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    await this.simulateDbLookup(data.id);
    const hero = heroes.find((h) => h.id === data.id) || { id: 0, name: 'Unknown' };
    return hero;
  }

  @GrpcMethod('HeroService', 'FindMany')
  async findMany(data: { name: string }) {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[hero-controller] FindMany called, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    // Multiple async operations that should all share the same trace context
    await this.simulateValidation(data.name);
    await this.simulateDbLookup(0);
    const filtered = heroes.filter((h) =>
      h.name.toLowerCase().includes((data.name || '').toLowerCase()),
    );
    return { heroes: filtered };
  }

  private async simulateDbLookup(id: number): Promise<void> {
    const tracer = trace.getTracer('repro');
    const span = tracer.startSpan('db-lookup');
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      span.end();
    }
  }

  private async simulateValidation(name: string): Promise<void> {
    const tracer = trace.getTracer('repro');
    const span = tracer.startSpan('validation');
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      span.end();
    }
  }
}
