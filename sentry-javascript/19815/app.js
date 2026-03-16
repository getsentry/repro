import * as Sentry from '@sentry/node';
import express from 'express';

const app = express();

let requestCount = 0;

app.get('/', async (_req, res) => {
  requestCount++;
  const reqNum = requestCount;

  // Capture the current trace context before captureException
  const scope = Sentry.getCurrentScope();
  const propagationContext = scope.getPropagationContext();
  console.log(`[request #${reqNum}] propagation traceId: ${propagationContext.traceId}`);

  Sentry.captureException(new Error(`Test Error from request #${reqNum}`));

  res.end(`ok (request #${reqNum})\n`);
});

const server = app.listen(3000, () => {
  console.log('App listening on port 3000');
  console.log('');
  console.log('Bug: All requests share the same traceId when tracing is disabled.');
  console.log('Each request should produce a different traceId.');
  console.log('');
  console.log('Run: curl http://localhost:3000 several times and observe the trace_id in the output.');
  console.log('');
});

// Auto-shutdown after 30 seconds to simplify testing
setTimeout(() => {
  server.close();
  process.exit(0);
}, 30_000);
