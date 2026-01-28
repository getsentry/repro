import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

@Controller()
export class StreamController {
  private langchainModel: ChatOpenAI | null = null;

  private getLangchainModel(): ChatOpenAI {
    if (!this.langchainModel) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "OPENAI_API_KEY not set. Export it with: export OPENAI_API_KEY=sk-..."
        );
      }
      this.langchainModel = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
        streaming: true,
      });
    }
    return this.langchainModel;
  }

  @Get("/")
  index() {
    return {
      message: "Sentry NestJS OpenAI Streaming Reproduction",
      issue: "https://github.com/getsentry/sentry-javascript/issues/18962",
      endpoints: {
        "/stream-openai": "Test OpenAI streaming with for-await (GET)",
        "/stream-langchain": "Test OpenAI streaming via Langchain (GET)",
      },
      sentryEnabled: process.env.ENABLE_SENTRY === "true",
      openaiKeySet: !!process.env.OPENAI_API_KEY,
    };
  }

  @Get("/stream-openai")
  async stream(@Res() res: Response) {
    try {
      const openai = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: undefined,
        timeout: undefined,
        maxRetries: 2,
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      console.log("\n📝 [OpenAI for-await] Starting streaming request...");
      const startTime = Date.now();
      let chunkCount = 0;

      const stream = await openai.stream(
        "Count from 1 to 20, each number on a new line. Be slow and deliberate."
      );

      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.content.toString() || "";
        if (content) {
          console.log(
            `  Chunk ${chunkCount}: "${content.replace(/\n/g, "\\n")}"`
          );
          res.write(content);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `\n✅ [OpenAI for-await] Completed in ${elapsed}ms, chunks: ${chunkCount}`
      );

      if (chunkCount < 10) {
        console.log(
          "\n⚠️  WARNING: Very few chunks received - streaming may be broken!"
        );
      }

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${
          process.env.ENABLE_SENTRY === "true" ? "ENABLED" : "disabled"
        }\n`
      );
    } catch (error) {
      console.error("❌ Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }

  @Get("/stream-langchain")
  async streamLangchain(@Res() res: Response) {
    try {
      const model = this.getLangchainModel();

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      console.log("\n📝 [Langchain] Starting streaming request...");
      const startTime = Date.now();
      let chunkCount = 0;

      // Using Langchain's streaming with .stream()
      const stream = await model.stream([
        new HumanMessage(
          "Count from 1 to 20, each number on a new line. Be slow and deliberate."
        ),
      ]);

      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.content;
        if (content) {
          console.log(
            `  Chunk ${chunkCount}: "${String(content).replace(/\n/g, "\\n")}"`
          );
          res.write(String(content));
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `\n✅ [Langchain] Completed in ${elapsed}ms, chunks: ${chunkCount}`
      );

      if (chunkCount < 10) {
        console.log(
          "\n⚠️  WARNING: Very few chunks received - streaming may be broken!"
        );
      }

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${
          process.env.ENABLE_SENTRY === "true" ? "ENABLED" : "disabled"
        }\nMethod: Langchain\n`
      );
    } catch (error) {
      console.error("❌ Langchain Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
