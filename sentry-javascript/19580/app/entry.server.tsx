import * as Sentry from "@sentry/react-router";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
});

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              pipe({
                write(chunk: string | Buffer) {
                  controller.enqueue(
                    typeof chunk === "string" ? encoder.encode(chunk) : chunk
                  );
                },
                end() {
                  controller.close();
                },
                on() {},
                off() {},
                removeListener() {},
                addListener() {},
                once() {},
                emit() { return false; },
                prependListener() { return this; },
                prependOnceListener() { return this; },
                listeners() { return []; },
                rawListeners() { return []; },
                listenerCount() { return 0; },
                eventNames() { return []; },
                getMaxListeners() { return 0; },
                setMaxListeners() { return this; },
              } as any);
            },
          });
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(body, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      } as RenderToPipeableStreamOptions
    );

    setTimeout(abort, 5000);
  });
}
