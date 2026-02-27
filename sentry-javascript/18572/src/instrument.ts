// This file must be loaded before anything else (--require or first import).
// It sets up Sentry + custom OpenTelemetry, mirroring the reporter's setup.

import * as os from 'os';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  CompositePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import * as opentelemetry from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import * as Sentry from '@sentry/nestjs';
import { SentryPropagator, SentrySpanProcessor } from '@sentry/opentelemetry';

import { CustomSampler } from './custom-sampler';
import { ContextDebugSpanProcessor } from './context-debug-processor';

const sentryClient = Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.DEPLOYMENT_ENV || 'development',
  skipOpenTelemetrySetup: true,
  integrations: [Sentry.httpIntegration({ spans: false })],
  // The reporter originally had tracesSampleRate: 1.0 but was told to remove it.
  // Including it here to match the original setup that triggered the bug.
  tracesSampleRate: 1.0,
  enabled: true,
});

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'repro-grpc-service',
  [ATTR_SERVICE_VERSION]: '1.0.0',
  'service.instance.id': os.hostname() || 'unknown',
});

// Use console exporter so we can see spans without a real collector
const consoleExporter = new ConsoleSpanExporter();

const customSampler = new ParentBasedSampler({
  root: new CustomSampler(),
});

const sdk = new opentelemetry.NodeSDK({
  resource,
  textMapPropagator: new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new SentryPropagator()],
  }),
  contextManager: new Sentry.SentryContextManager(),
  sampler: customSampler,
  spanProcessors: [
    new ContextDebugSpanProcessor(),
    new SimpleSpanProcessor(consoleExporter),
    new SentrySpanProcessor(),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      '@opentelemetry/instrumentation-grpc': { enabled: true },
    }),
  ],
});

sdk.start();
Sentry.validateOpenTelemetrySetup();

console.log('[instrument] Sentry + OpenTelemetry initialized');

// Now boot the NestJS app
require('./main');
