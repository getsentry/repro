"""Reproduction for getsentry/sdk-repro-test-python#8.

With Starlette's AuthenticationMiddleware and send_default_pii=True, the
Starlette integration replaces the user set by the endpoint with
sentry_sdk.set_user(...). Only the auth backend's `username` is left.
"""

import sys

import sentry_sdk
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.applications import Starlette
from starlette.authentication import AuthCredentials, AuthenticationBackend, SimpleUser
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

EXPECTED_USER = {"id": "user_42", "email": "real@user.com", "username": "token-subject-123"}

captured = {"event": [], "transaction": []}


class TokenBackend(AuthenticationBackend):
    async def authenticate(self, conn):
        return AuthCredentials(["authenticated"]), SimpleUser("token-subject-123")


async def endpoint(request):
    # The app sets the full user. It should be on every event in this request.
    sentry_sdk.set_user(dict(EXPECTED_USER))
    sentry_sdk.capture_message("hello from endpoint")
    return PlainTextResponse("ok")


def before_send(event, hint):
    captured["event"].append(event.get("user"))
    return None


def before_send_transaction(event, hint):
    captured["transaction"].append(event.get("user"))
    return None


sentry_sdk.init(
    dsn="https://public@example.com/1",
    integrations=[StarletteIntegration()],
    send_default_pii=True,
    traces_sample_rate=1.0,
    before_send=before_send,
    before_send_transaction=before_send_transaction,
)

app = Starlette(
    routes=[Route("/", endpoint)],
    middleware=[Middleware(AuthenticationMiddleware, backend=TokenBackend())],
)
TestClient(app).get("/")
sentry_sdk.flush()

print("sentry-sdk", sentry_sdk.VERSION, "from", sentry_sdk.__file__)
print("expected user:", EXPECTED_USER)
failed = False
for kind, users in captured.items():
    print(f"{kind} users:", users)
    if users != [EXPECTED_USER]:
        failed = True

if failed:
    print("BUG: the user set in the endpoint was overwritten by the Starlette integration")
    sys.exit(1)
print("OK: the user set in the endpoint was kept")
