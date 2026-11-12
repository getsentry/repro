"""
Reproduction for getsentry/sentry-python#5812

The Google GenAI integration sets `gen_ai.response.id` and `gen_ai.response.model`
on the chat span for `generate_content`, but not for `generate_content_stream`,
even when every streamed chunk carries `responseId` and `modelVersion`.

The Gemini API is replaced by an in-memory httpx transport, so no network
request is made. Spans are collected with an in-memory Sentry transport.
"""

import json
import sys

import httpx2 as httpx
import sentry_sdk
from google import genai
from google.genai import types
from sentry_sdk.consts import SPANDATA
from sentry_sdk.integrations.google_genai import GoogleGenAIIntegration
from sentry_sdk.transport import Transport

RESPONSE_ID = "response-id-abc123"
MODEL_VERSION = "gemini-2.5-flash-001"

CHUNKS = [
    {
        "candidates": [{"content": {"role": "model", "parts": [{"text": "Hello! "}]}}],
        "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 2, "totalTokenCount": 7},
        "responseId": RESPONSE_ID,
        "modelVersion": MODEL_VERSION,
    },
    {
        "candidates": [
            {
                "content": {"role": "model", "parts": [{"text": "How can I help?"}]},
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 6, "totalTokenCount": 11},
        "responseId": RESPONSE_ID,
        "modelVersion": MODEL_VERSION,
    },
]

NON_STREAMING_RESPONSE = {
    "candidates": [
        {
            "content": {"role": "model", "parts": [{"text": "Hello! How can I help?"}]},
            "finishReason": "STOP",
        }
    ],
    "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 6, "totalTokenCount": 11},
    "responseId": RESPONSE_ID,
    "modelVersion": MODEL_VERSION,
}


def fake_gemini(request: httpx.Request) -> httpx.Response:
    if ":streamGenerateContent" in request.url.path:
        body = "".join(f"data: {json.dumps(chunk)}\r\n\r\n" for chunk in CHUNKS)
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=body)
    return httpx.Response(200, json=NON_STREAMING_RESPONSE)


class CaptureTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.spans = []

    def capture_envelope(self, envelope):
        # Gen AI spans are sent as standalone "span" envelope items
        # (stream_gen_ai_spans defaults to True).
        for item in envelope.items:
            if item.type == "span":
                for span in item.payload.json["items"]:
                    attributes = {k: v["value"] for k, v in span["attributes"].items()}
                    self.spans.append(attributes)


transport = CaptureTransport()
sentry_sdk.init(
    dsn="https://public@example.com/1",
    traces_sample_rate=1.0,
    integrations=[GoogleGenAIIntegration()],
    transport=transport,
)

client = genai.Client(
    api_key="test-api-key",
    http_options=types.HttpOptions(
        httpx_client=httpx.Client(transport=httpx.MockTransport(fake_gemini))
    ),
)

with sentry_sdk.start_transaction(name="non-streaming"):
    client.models.generate_content(model="gemini-2.5-flash", contents="Hi")

with sentry_sdk.start_transaction(name="streaming"):
    for _ in client.models.generate_content_stream(model="gemini-2.5-flash", contents="Hi"):
        pass

sentry_sdk.flush()


def chat_span_data(name):
    streaming = name == "streaming"
    (span,) = [
        s
        for s in transport.spans
        if s.get(SPANDATA.GEN_AI_OPERATION_NAME) == "chat"
        and bool(s.get(SPANDATA.GEN_AI_RESPONSE_STREAMING)) == streaming
    ]
    return span


failed = False
for name in ("non-streaming", "streaming"):
    data = chat_span_data(name)
    response_id = data.get(SPANDATA.GEN_AI_RESPONSE_ID)
    response_model = data.get(SPANDATA.GEN_AI_RESPONSE_MODEL)
    print(f"[{name}]")
    print(f"  {SPANDATA.GEN_AI_RESPONSE_ID}: {response_id!r} (expected {RESPONSE_ID!r})")
    print(f"  {SPANDATA.GEN_AI_RESPONSE_MODEL}: {response_model!r} (expected {MODEL_VERSION!r})")
    if response_id != RESPONSE_ID or response_model != MODEL_VERSION:
        failed = True

print()
print(f"sentry-sdk loaded from: {sentry_sdk.__file__}")
if failed:
    print("BUG REPRODUCED: gen_ai.response.id / gen_ai.response.model missing on a chat span.")
    sys.exit(1)
print("OK: both chat spans carry gen_ai.response.id and gen_ai.response.model.")
