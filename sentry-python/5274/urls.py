import logging
from django.contrib import admin
from django.urls import path
from django.http import HttpResponse

# Enable debug logging for sentry_sdk to see internal errors
logging.basicConfig(level=logging.DEBUG)
logging.getLogger("sentry_sdk").setLevel(logging.DEBUG)


async def async_view(request):
    """
    An async view that triggers Sentry error capture.

    When send_default_pii=True, Sentry's Django integration will try to
    access request.user.is_authenticated synchronously in the ASGI event
    processor, which triggers SynchronousOnlyOperation on Django 5.x.

    The error happens in sentry_sdk/integrations/django/asgi.py when
    _set_user_info() is called, which accesses request.user.is_authenticated.
    """
    print(f"\n{'='*60}")
    print(f"Request user type: {type(request.user)}")
    print(f"Is async context: True (this is an async view)")
    print(f"{'='*60}\n")

    # Trigger an error to be captured by Sentry
    # The bug manifests when Sentry tries to capture user info
    try:
        raise ValueError("Test error to trigger Sentry capture")
    except ValueError:
        import sentry_sdk
        # This capture_exception call triggers the ASGI event processor
        # which will try to access request.user.is_authenticated synchronously
        sentry_sdk.capture_exception()
        print("Exception captured by Sentry - check for SynchronousOnlyOperation in logs")

    return HttpResponse(
        "Check the server console for SynchronousOnlyOperation error from Sentry SDK.\n"
        "The error occurs when Sentry tries to access request.user.is_authenticated "
        "in the ASGI event processor."
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", async_view),
]
