"""
Reproduction for getsentry/sdk-repro-test-python#26.

With StarletteIntegration, send_default_pii=True and Starlette's
AuthenticationMiddleware, the user that the endpoint sets with
sentry_sdk.set_user(...) is replaced by the user from the auth backend
(only `username`) after the endpoint returns.

Expected: the transaction's user is the one the endpoint set
          {'id': 'user_42', 'email': 'real@user.com', 'username': 'token-subject-123'}
Actual:   {'username': 'token-subject-123'}

Exits 1 while the bug is present, 0 once it is fixed. Sends nothing.
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

EXPECTED_USER = {
    "id": "user_42",
    "email": "real@user.com",
    "username": "token-subject-123",
}

captured = []


class TokenBackend(AuthenticationBackend):
    async def authenticate(self, conn):
        return AuthCredentials(["authenticated"]), SimpleUser("token-subject-123")


async def endpoint(request):
    # The app sets the full user. This should be what Sentry reports.
    sentry_sdk.set_user(dict(EXPECTED_USER))
    return PlainTextResponse("ok")


def before_send_transaction(event, hint):
    captured.append(event.get("user"))
    return None  # send nothing


sentry_sdk.init(
    dsn="https://public@example.com/1",
    integrations=[StarletteIntegration()],
    send_default_pii=True,
    traces_sample_rate=1.0,
    before_send_transaction=before_send_transaction,
)

app = Starlette(
    routes=[Route("/", endpoint)],
    middleware=[Middleware(AuthenticationMiddleware, backend=TokenBackend())],
)
TestClient(app).get("/")

print("sentry_sdk version:", sentry_sdk.VERSION)
print("sentry_sdk loaded from:", sentry_sdk.__file__)
print("expected user:", EXPECTED_USER)
print("captured user:", captured[0] if captured else None)

if captured != [EXPECTED_USER]:
    print("BUG REPRODUCED: the user set in the endpoint was overwritten")
    sys.exit(1)

print("OK: the user set in the endpoint was kept")
