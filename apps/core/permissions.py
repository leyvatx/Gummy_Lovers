from django.conf import settings
from rest_framework.permissions import BasePermission


class AllowedAdminUser(BasePermission):
    message = "Solo Efrain Leyva y Erika Mora pueden acceder al ERP."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        allowed_users = getattr(settings, "ALLOWED_ADMIN_USERS", {})
        allowed_usernames = set(allowed_users.keys())
        allowed_emails = {email.lower() for email in allowed_users.values()}

        return (
            user.is_active
            and user.is_staff
            and user.is_superuser
            and (user.username in allowed_usernames or user.email.lower() in allowed_emails)
        )

