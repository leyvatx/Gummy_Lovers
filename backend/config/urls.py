import os

from django.contrib import admin
from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path
from django.urls import re_path
from django.views.generic import TemplateView


def healthcheck(_request):
    return JsonResponse({"status": "ok", "commit": os.environ.get("RENDER_GIT_COMMIT", "local")})


urlpatterns = [
    path("healthz/", healthcheck, name="healthcheck"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
]

if settings.FRONTEND_DIST_DIR.exists():
    urlpatterns.append(
        re_path(r"^(?!api/|admin/|healthz/|static/).*$", TemplateView.as_view(template_name="index.html")),
    )
