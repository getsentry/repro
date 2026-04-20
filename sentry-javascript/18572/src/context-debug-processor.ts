// A custom SpanProcessor that logs context propagation details.
// It distinguishes expected root spans (for example incoming HTTP requests)
// from unexpected roots that are more likely to indicate broken propagation.

import { SpanKind } from '@opentelemetry/api';
import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-node';
import type { Span } from '@opentelemetry/sdk-trace-node';

export class ContextDebugSpanProcessor implements SpanProcessor {
  private expectedRootCount = 0;
  private unexpectedRootCount = 0;
  private childCount = 0;
  private readonly LOG_LIMIT = 10;

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
    const kind = SpanKind[span.kind] ?? String(span.kind);

    if (parentSpanId) {
      this.childCount++;
      if (this.childCount <= this.LOG_LIMIT) {
        console.log(
          `[CONTEXT-DEBUG] CHILD (${this.childCount}) span: "${span.name}" ` +
          `kind=${kind} traceId=${sc.traceId} spanId=${sc.spanId} parentSpanId=${parentSpanId}`
        );
      }
      if (this.childCount === this.LOG_LIMIT) {
        console.log(`[CONTEXT-DEBUG] ... further CHILD logs suppressed (limit ${this.LOG_LIMIT})`);
      }
      return;
    }

    if (isExpectedRootSpan(span)) {
      this.expectedRootCount++;
      if (this.expectedRootCount <= this.LOG_LIMIT) {
        console.log(
          `[CONTEXT-DEBUG] EXPECTED_ROOT (${this.expectedRootCount}) span: "${span.name}" ` +
          `kind=${kind} traceId=${sc.traceId} spanId=${sc.spanId}`
        );
      }
      if (this.expectedRootCount === this.LOG_LIMIT) {
        console.log(
          `[CONTEXT-DEBUG] ... further EXPECTED_ROOT logs suppressed (limit ${this.LOG_LIMIT})`,
        );
      }
      return;
    }

    this.unexpectedRootCount++;
    if (this.unexpectedRootCount <= this.LOG_LIMIT) {
      console.log(
        `[CONTEXT-DEBUG] UNEXPECTED_ROOT (${this.unexpectedRootCount}) span: "${span.name}" ` +
        `kind=${kind} traceId=${sc.traceId} spanId=${sc.spanId}`
      );
    }
    if (this.unexpectedRootCount === this.LOG_LIMIT) {
      console.log(
        `[CONTEXT-DEBUG] ... further UNEXPECTED_ROOT logs suppressed (limit ${this.LOG_LIMIT})`,
      );
    }
  }
}

function isExpectedRootSpan(span: ReadableSpan): boolean {
  if (span.name === 'Create Nest App') {
    return true;
  }

  const method =
    span.attributes['http.request.method'] ||
    span.attributes['http.method'];

  if (
    span.kind === SpanKind.SERVER &&
    typeof method === 'string' &&
    span.name.startsWith(`${method} `)
  ) {
    return true;
  }

  return /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) \//.test(span.name);
}
