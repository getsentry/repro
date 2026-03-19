import * as Sentry from "@sentry/cloudflare";
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";

interface Env {
  MY_WORKFLOW: Workflow;
  SENTRY_DSN: string;
}

interface MyParams {
  message: string;
}

// Workflow class — accesses ctx.attempt in step.do callback
export class MyWorkflow extends WorkflowEntrypoint<Env, MyParams> {
  async run(event: WorkflowEvent<MyParams>, step: WorkflowStep) {
    const result = await step.do("my step", async (ctx) => {
      // ctx.attempt should be a number (1 on first try) per:
      // https://developers.cloudflare.com/changelog/post/2026-03-06-step-context-available/
      console.log("ctx:", JSON.stringify(ctx));
      console.log("ctx?.attempt:", ctx?.attempt);

      if (ctx === undefined) {
        console.log("BUG: ctx is undefined — Sentry wrapper swallowed it!");
      } else {
        console.log("OK: ctx.attempt =", ctx.attempt);
      }

      return { attempt: ctx?.attempt, message: event.payload.message };
    });

    return result;
  }
}

// Wrap with Sentry instrumentation — this is where ctx gets lost
export const InstrumentedWorkflow = Sentry.instrumentWorkflowWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN || "",
  }),
  MyWorkflow,
);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/run") {
      const instance = await env.MY_WORKFLOW.create({
        params: { message: "hello from repro" },
      });
      return Response.json({
        id: instance.id,
        details: await instance.status(),
      });
    }

    if (url.pathname === "/status") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("Missing ?id=", { status: 400 });
      const instance = await env.MY_WORKFLOW.get(id);
      return Response.json(await instance.status());
    }

    return new Response(
      "GET /run    — start a workflow instance\n" +
      "GET /status?id=<id> — check workflow status\n",
      { headers: { "Content-Type": "text/plain" } },
    );
  },
};
