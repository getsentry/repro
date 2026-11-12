# Reproduction for sentry-python#5812

**Issue:** https://github.com/getsentry/sentry-python/issues/5812

## Description

The Google GenAI integration sets `gen_ai.response.id` and `gen_ai.response.model` on the chat span for `generate_content`, but not for `generate_content_stream`. `accumulate_streaming_response()` in `sentry_sdk/integrations/google_genai/streaming.py` initializes `response_id` and `model` to `None` and never reads them from the chunks.

The repro makes one non-streaming and one streaming call against an in-memory fake of the Gemini API (an `httpx2.MockTransport` passed through `HttpOptions(httpx_client=...)`). Every streamed chunk carries `responseId` and `modelVersion`. Spans are collected with an in-memory Sentry transport; nothing is sent.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Run the reproduction:
   ```bash
   python repro.py
   ```

   Exits 1 when the bug reproduces, 0 when both chat spans carry the two attributes.

## Expected Behavior

Both chat spans have `gen_ai.response.id = "response-id-abc123"` and `gen_ai.response.model = "gemini-2.5-flash-001"`.

## Actual Behavior

```
[non-streaming]
  gen_ai.response.id: 'response-id-abc123' (expected 'response-id-abc123')
  gen_ai.response.model: 'gemini-2.5-flash-001' (expected 'gemini-2.5-flash-001')
[streaming]
  gen_ai.response.id: None (expected 'response-id-abc123')
  gen_ai.response.model: None (expected 'gemini-2.5-flash-001')

BUG REPRODUCED: gen_ai.response.id / gen_ai.response.model missing on a chat span.
```

## Environment

- Python: 3.12
- sentry-sdk: 2.74.0
- google-genai: 3.2.0
