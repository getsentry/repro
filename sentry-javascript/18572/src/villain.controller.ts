import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { context, trace } from '@opentelemetry/api';

const villains = [
  { id: 1, name: 'Joker' },
  { id: 2, name: 'Lex Luthor' },
  { id: 3, name: 'Thanos' },
];

@Controller()
export class VillainController {
  @GrpcMethod('VillainService', 'FindOne')
  async findOne(data: { id: number }) {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[villain-controller] FindOne called, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    await this.simulateDbLookup(data.id);
    const villain = villains.find((v) => v.id === data.id) || { id: 0, name: 'Unknown' };
    return villain;
  }

  @GrpcMethod('VillainService', 'FindMany')
  async findMany(data: { name: string }) {
    const currentSpan = trace.getSpan(context.active());
    console.log(
      `[villain-controller] FindMany called, active span: ${currentSpan?.spanContext().spanId || 'NONE'}`,
    );

    await this.simulateValidation(data.name);
    await this.simulateDbLookup(0);
    const filtered = villains.filter((v) =>
      v.name.toLowerCase().includes((data.name || '').toLowerCase()),
    );
    return { villains: filtered };
  }

  private async simulateDbLookup(id: number): Promise<void> {
    const tracer = trace.getTracer('repro');
    const span = tracer.startSpan('villain-db-lookup');
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      span.end();
    }
  }

  private async simulateValidation(name: string): Promise<void> {
    const tracer = trace.getTracer('repro');
    const span = tracer.startSpan('villain-validation');
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      span.end();
    }
  }
}
