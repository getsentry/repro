// A custom SpanProcessor that logs context propagation details.
// This helps visualize whether spans are correctly parented or appear as orphaned root spans.

import { context, trace } from '@opentelemetry/api';
import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-node';
import type { Span } from '@opentelemetry/sdk-trace-node';

export class ContextDebugSpanProcessor implements SpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span): void {
    const parentContext = context.active();
    const parentSpan = trace.getSpan(parentContext);
    const spanContext = span.spanContext();
    const parentSpanContext = parentSpan?.spanContext();

    const isRoot = !parentSpanContext || parentSpanContext.traceId !== spanContext.traceId;

    if (isRoot) {
      console.log(
        `[CONTEXT-DEBUG] ROOT span started: "${span['name'] || 'unknown'}" ` +
        `traceId=${spanContext.traceId} spanId=${spanContext.spanId}`
      );
    } else {
      console.log(
        `[CONTEXT-DEBUG] CHILD span started: "${span['name'] || 'unknown'}" ` +
        `traceId=${spanContext.traceId} spanId=${spanContext.spanId} ` +
        `parentSpanId=${parentSpanContext.spanId}`
      );
    }
  }

  onEnd(span: ReadableSpan): void {
    // Check if this span has a parentSpanId set
    const parentSpanId = (span as any).parentSpanId;
    if (!parentSpanId) {
      console.log(
        `[CONTEXT-DEBUG] ORPHAN span ended (no parent): "${span.name}" ` +
        `traceId=${span.spanContext().traceId} spanId=${span.spanContext().spanId}`
      );
    }
  }
}
