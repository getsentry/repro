// A custom SpanProcessor that logs context propagation details.
// This helps visualize whether spans are correctly parented or appear as orphaned root spans.

import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-node';
import type { Span } from '@opentelemetry/sdk-trace-node';

export class ContextDebugSpanProcessor implements SpanProcessor {
  private orphanCount = 0;
  private parentedCount = 0;
  private readonly LOG_LIMIT = 1000;

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span): void {
    // Logging moved to onEnd for a unified view
  }

  onEnd(span: ReadableSpan): void {
    // OTel SDK 2.x uses parentSpanContext (full SpanContext), not parentSpanId
    const parentSpanId = span.parentSpanContext?.spanId;
    const sc = span.spanContext();

    if (!parentSpanId) {
      this.orphanCount++;
      if (this.orphanCount <= this.LOG_LIMIT) {
        console.log(
          `[CONTEXT-DEBUG] ORPHAN (${this.orphanCount}) span: "${span.name}" ` +
          `traceId=${sc.traceId} spanId=${sc.spanId}`
        );
      }
      if (this.orphanCount === this.LOG_LIMIT) {
        console.log(`[CONTEXT-DEBUG] ... further ORPHAN logs suppressed (limit ${this.LOG_LIMIT})`);
      }
    } else {
      this.parentedCount++;
      if (this.parentedCount <= this.LOG_LIMIT) {
        console.log(
          `[CONTEXT-DEBUG] PARENTED (${this.parentedCount}) span: "${span.name}" ` +
          `traceId=${sc.traceId} spanId=${sc.spanId} parentSpanId=${parentSpanId}`
        );
      }
      if (this.parentedCount === this.LOG_LIMIT) {
        console.log(`[CONTEXT-DEBUG] ... further PARENTED logs suppressed (limit ${this.LOG_LIMIT})`);
      }
    }
  }
}
