from django.http import JsonResponse
from django.urls import path


def debug_headers(request):
    """Endpoint that shows how Django interprets the request scheme."""
    return JsonResponse(
        {
            "X-Forwarded-Proto": request.META.get("HTTP_X_FORWARDED_PROTO"),
            "request.scheme": request.scheme,
            "request.is_secure": request.is_secure(),
        }
    )


def trigger_error(request):
    """Endpoint that triggers an error so Sentry captures it."""
    raise ValueError("Test error to demonstrate URL scheme bug")


urlpatterns = [
    path("debug/", debug_headers),
    path("error/", trigger_error),
]
