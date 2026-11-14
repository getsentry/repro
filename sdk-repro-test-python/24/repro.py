"""
Reproduction for getsentry/sdk-repro-test-python#24

`set_user` with a field set to `None` makes that field show up on logs as the
literal string "None" (for example `user.name: "None"`).

An in-memory transport records envelopes, so nothing leaves the machine.

Exits 1 while the bug is present, 0 once it is fixed.
"""

import sys

import sentry_sdk
from sentry_sdk.transport import Transport

envelopes = []


class Capture(Transport):
    def capture_envelope(self, envelope):
        envelopes.append(envelope)


def main():
    sentry_sdk.init(
        dsn="https://public@example.com/1",
        transport=Capture(),
        enable_logs=True,
        send_default_pii=True,
    )
    print("sentry_sdk", sentry_sdk.VERSION, "from", sentry_sdk.__file__)

    # `username` is None: it should be left out, not sent as "None".
    sentry_sdk.set_user({"email": "ada@example.com", "username": None})
    sentry_sdk.logger.info("hello")
    sentry_sdk.flush()

    user_attrs = {}
    for envelope in envelopes:
        for item in envelope.items:
            if item.headers.get("type") == "log":
                for log in item.payload.json["items"]:
                    user_attrs.update(
                        {
                            k: v
                            for k, v in log["attributes"].items()
                            if k.startswith("user.")
                        }
                    )

    print("user attributes on the log:", user_attrs)

    if not user_attrs:
        print("FAIL: no log captured")
        return 1

    bad = {k: v for k, v in user_attrs.items() if v.get("value") == "None"}
    if bad:
        print('BUG: None user fields were sent as the string "None":', bad)
        return 1

    print("OK: no None user fields were stringified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
