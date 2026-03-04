// @ts-nocheck
import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

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
      const agent = createAgent({
        model: "openai:gpt-4o-mini",
        tools: [],
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      console.log("\n[agent.stream] Starting streaming request...");
      const startTime = Date.now();
      let chunkCount = 0;
      let contentChunkCount = 0;

      // @ts-ignore - type instantiation issues with langchain generics
      const stream = await agent.stream({
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
        const elapsed = Date.now() - startTime;
        // chunk is ["messages", AIMessageChunk] or similar tuple
        const msg = Array.isArray(chunk[1]) ? chunk[1][0] : chunk[1];
        const content = msg?.kwargs?.content ?? msg?.content ?? "";
        if (content) {
          contentChunkCount++;
          console.log(
            `  [${elapsed}ms] Chunk ${contentChunkCount}: "${String(content).replace(/\n/g, "\\n")}"`,
          );
          res.write(String(content));
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `\n[agent.stream] Done in ${elapsed}ms, total chunks: ${chunkCount}, content chunks: ${contentChunkCount}`,
      );

      if (contentChunkCount < 10) {
        console.log(
          "WARNING: Very few content chunks received - streaming may be broken!",
        );
      }

      res.end(
        `\n\n--- Stats ---\nTotal chunks: ${chunkCount}\nContent chunks: ${contentChunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === "true" ? "ENABLED" : "disabled"}\n`,
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
      let contentChunkCount = 0;

      const stream = await model.stream(
        "Count from 1 to 20, each number on a new line. Be slow and deliberate.",
      );

      for await (const chunk of stream) {
        chunkCount++;
        const elapsed = Date.now() - startTime;
        const content = chunk.content.toString() || "";
        if (content) {
          contentChunkCount++;
          console.log(
            `  [${elapsed}ms] Chunk ${contentChunkCount}: "${content.replace(/\n/g, "\\n")}"`,
          );
          res.write(content);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `\n[model.stream] Done in ${elapsed}ms, total chunks: ${chunkCount}, content chunks: ${contentChunkCount}`,
      );

      res.end(
        `\n\n--- Stats ---\nTotal chunks: ${chunkCount}\nContent chunks: ${contentChunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === "true" ? "ENABLED" : "disabled"}\nMethod: direct model.stream()\n`,
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
