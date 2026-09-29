"""
URL configuration for the Pay-Together project.
"""
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from django.conf import settings

from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("", include("apps.core.urls", namespace="core")),
    path("", include("apps.accounts.urls", namespace="accounts")),
    path("", include("apps.tours.urls", namespace="tours")),
    path("", include("apps.expenses.urls", namespace="expenses")),
    path("", include("apps.reports.urls", namespace="reports")),

    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

# Tour images are uploaded to MEDIA_ROOT.  The previous DEBUG-only route meant
# they returned 404 whenever DEBUG=False (including the current local setup),
# so the detail-page image could never load.  A production deployment can
# still have its web server serve this URL first.
urlpatterns += [
    re_path(
        rf"^{settings.MEDIA_URL.lstrip('/')}(?P<path>.*)$",
        serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]
