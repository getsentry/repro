import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

@Controller()
export class StreamController {
  private openai: OpenAI | null = null;
  private langchainModel: ChatOpenAI | null = null;

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set. Export it with: export OPENAI_API_KEY=sk-...');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  private getLangchainModel(): ChatOpenAI {
    if (!this.langchainModel) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set. Export it with: export OPENAI_API_KEY=sk-...');
      }
      this.langchainModel = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        streaming: true,
      });
    }
    return this.langchainModel;
  }

  @Get('/')
  index() {
    return {
      message: 'Sentry NestJS OpenAI Streaming Reproduction',
      issue: 'https://github.com/getsentry/sentry-javascript/issues/18962',
      endpoints: {
        '/stream': 'Test OpenAI streaming with for-await (GET)',
        '/stream-langchain': 'Test OpenAI streaming via Langchain (GET)',
        '/stream-web': 'Test OpenAI streaming with toReadableStream() (GET)',
        '/stream-sse': 'Test OpenAI streaming with SSE (GET)',
      },
      sentryEnabled: process.env.ENABLE_SENTRY === 'true',
      openaiKeySet: !!process.env.OPENAI_API_KEY,
    };
  }

  @Get('/stream')
  async stream(@Res() res: Response) {
    try {
      const openai = this.getOpenAI();

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      console.log('\n📝 [OpenAI for-await] Starting streaming request...');
      const startTime = Date.now();
      let chunkCount = 0;

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 20, each number on a new line. Be slow and deliberate.',
          },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          console.log(`  Chunk ${chunkCount}: "${content.replace(/\n/g, '\\n')}"`);
          res.write(content);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`\n✅ [OpenAI for-await] Completed in ${elapsed}ms, chunks: ${chunkCount}`);

      if (chunkCount < 10) {
        console.log('\n⚠️  WARNING: Very few chunks received - streaming may be broken!');
      }

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === 'true' ? 'ENABLED' : 'disabled'}\n`,
      );
    } catch (error) {
      console.error('❌ Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  // Using OpenAI's toReadableStream() - Web Streams API
  @Get('/stream-web')
  async streamWeb(@Res() res: Response) {
    try {
      const openai = this.getOpenAI();

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      console.log('\n📝 [OpenAI toReadableStream] Starting streaming request...');
      const startTime = Date.now();
      let chunkCount = 0;

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 20, each number on a new line.',
          },
        ],
        stream: true,
      });

      // Using the toReadableStream() method from OpenAI SDK
      const webStream = stream.toReadableStream();
      const reader = webStream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        const text = decoder.decode(value, { stream: true });
        console.log(`  WebStream Chunk ${chunkCount}: "${text.substring(0, 50)}..."`);
        res.write(text);
      }

      const elapsed = Date.now() - startTime;
      console.log(`\n✅ [OpenAI toReadableStream] Completed in ${elapsed}ms, chunks: ${chunkCount}`);

      if (chunkCount < 10) {
        console.log('\n⚠️  WARNING: Very few chunks received - streaming may be broken!');
      }

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === 'true' ? 'ENABLED' : 'disabled'}\nMethod: toReadableStream\n`,
      );
    } catch (error) {
      console.error('❌ WebStream Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  @Get('/stream-langchain')
  async streamLangchain(@Res() res: Response) {
    try {
      const model = this.getLangchainModel();

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      console.log('\n📝 [Langchain] Starting streaming request...');
      const startTime = Date.now();
      let chunkCount = 0;

      // Using Langchain's streaming with .stream()
      const stream = await model.stream([
        new HumanMessage('Count from 1 to 20, each number on a new line. Be slow and deliberate.'),
      ]);

      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.content;
        if (content) {
          console.log(`  Chunk ${chunkCount}: "${String(content).replace(/\n/g, '\\n')}"`);
          res.write(String(content));
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`\n✅ [Langchain] Completed in ${elapsed}ms, chunks: ${chunkCount}`);

      if (chunkCount < 10) {
        console.log('\n⚠️  WARNING: Very few chunks received - streaming may be broken!');
      }

      res.end(
        `\n\n--- Stats ---\nChunks: ${chunkCount}\nTime: ${elapsed}ms\nSentry: ${process.env.ENABLE_SENTRY === 'true' ? 'ENABLED' : 'disabled'}\nMethod: Langchain\n`,
      );
    } catch (error) {
      console.error('❌ Langchain Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  @Get('/stream-sse')
  async streamSSE(@Res() res: Response) {
    try {
      const openai = this.getOpenAI();

      // Server-Sent Events format
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      console.log('\n📝 [SSE] Starting streaming request...');
      const startTime = Date.now();
      let chunkCount = 0;

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 20, each number on a new line.',
          },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          console.log(`  SSE Chunk ${chunkCount}: "${content.replace(/\n/g, '\\n')}"`);
          res.write(`data: ${JSON.stringify({ content, chunk: chunkCount })}\n\n`);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`\n✅ [SSE] Completed in ${elapsed}ms, chunks: ${chunkCount}`);

      res.write(`data: ${JSON.stringify({ done: true, totalChunks: chunkCount, elapsed })}\n\n`);
      res.end();
    } catch (error) {
      console.error('❌ SSE Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
