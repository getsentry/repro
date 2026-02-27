// Custom sampler matching the reporter's setup.
// Filters out health check spans and wraps decisions for Sentry.

import { Attributes, Context, Link, SpanKind } from '@opentelemetry/api';
import {
  Sampler,
  SamplingDecision,
  SamplingResult,
} from '@opentelemetry/sdk-trace-node';
import { wrapSamplingDecision } from '@sentry/opentelemetry';

const HEALTHCHECK_SPAN_NAMES = [
  'grpc.grpc.health.v1.Health/Check',
  'GET /health',
];

export class CustomSampler implements Sampler {
  shouldSample(
    context: Context,
    _traceId: string,
    spanName: string,
    _spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    const decision = healthcheckFilteringDecisionLogic(spanName, attributes);
    return wrapSamplingDecision({
      decision,
      context,
      spanAttributes: attributes,
    });
  }
}

function healthcheckFilteringDecisionLogic(
  spanName: string,
  attributes: Attributes,
): SamplingDecision {
  const isHealthcheck =
    HEALTHCHECK_SPAN_NAMES.includes(spanName) ||
    attributes['http.target'] === '/health';
  if (isHealthcheck) {
    return SamplingDecision.NOT_RECORD;
  }
  return SamplingDecision.RECORD_AND_SAMPLED;
}
