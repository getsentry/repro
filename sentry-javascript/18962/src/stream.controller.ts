import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

@Controller()
export class StreamController {
  @Get("/")
  index() {
    return {
      message: "Reproduction for sentry-javascript#18962",
      issue: "https://github.com/getsentry/sentry-javascript/issues/18962",
      endpoints: {
        "/stream-agent":
          "Test LangGraph agent streaming (reproduces the bug)",
        "/stream-model":
          "Test direct ChatOpenAI model streaming (works fine)",
      },
      sentryEnabled: process.env.ENABLE_SENTRY === "true",
    };
  }

  // This endpoint reproduces the bug.
  // With Sentry tracing enabled, the stream delivers the full response
  // in one chunk instead of streaming incrementally.
  @Get("/stream-agent")
  async streamAgent(@Res() res: Response) {
    try {
      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
        streaming: true,
      });

      const agent = createReactAgent({ llm: model, tools: [] });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      console.log("\n[agent.stream] Starting streaming request...");
      const startTime = Date.now();
      let chunkCount = 0;

      const stream = await agent.stream(
        {
          messages: [
            {
              role: "user",
              content:
                "Count from 1 to 20, each number on a new line. Be slow and deliberate.",
            },
          ],
        },
        { streamMode: ["messages"] },
      );

      for await (const chunk of stream) {
        chunkCount++;
        // chunk is [streamMode, data] tuple when using streamMode array
        const data = chunk[1];
        const content = data?.content ?? "";
        if (content) {
          console.log(
            `  Chunk ${chunkCount}: "${String(content).replace(/\n/g, "\\n")}"`,
          );
          res.write(String(content));
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `\n[agent.stream] Done in ${elapsed}ms, chunks: ${chunkCount}`,
      );

      if (chunkCount < 10) {
        console.log(
          "WARNING: Very few chunks received - streaming may be broken!",
        );
      }

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === "true" ? "ENABLED" : "disabled"}\n`,
      );
    } catch (error: any) {
      console.error("Error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.end(`\nError: ${error.message}`);
      }
    }
  }

  // This endpoint uses direct model streaming for comparison.
  // It typically works fine even with Sentry enabled.
  @Get("/stream-model")
  async streamModel(@Res() res: Response) {
    try {
      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
        streaming: true,
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      console.log("\n[model.stream] Starting streaming request...");
      const startTime = Date.now();
      let chunkCount = 0;

      const stream = await model.stream(
        "Count from 1 to 20, each number on a new line. Be slow and deliberate.",
      );

      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.content.toString() || "";
        if (content) {
          console.log(
            `  Chunk ${chunkCount}: "${content.replace(/\n/g, "\\n")}"`,
          );
          res.write(content);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `\n[model.stream] Done in ${elapsed}ms, chunks: ${chunkCount}`,
      );

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === "true" ? "ENABLED" : "disabled"}\nMethod: direct model.stream()\n`,
      );
    } catch (error: any) {
      console.error("Error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.end(`\nError: ${error.message}`);
      }
    }
  }
}
