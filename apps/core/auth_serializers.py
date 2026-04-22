from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from rest_framework import serializers


User = get_user_model()


class AuthenticatedUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "full_name", "is_staff", "is_superuser"]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        identifier = attrs["email"].strip().lower()
        password = attrs["password"]

        username = identifier
        if "@" in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
            if user:
                username = user.username

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )
        if not user:
            raise serializers.ValidationError("Credenciales inválidas.")

        allowed_users = getattr(settings, "ALLOWED_ADMIN_USERS", {})
        allowed_usernames = set(allowed_users.keys())
        allowed_emails = {email.lower() for email in allowed_users.values()}

        is_allowed = user.username in allowed_usernames or user.email.lower() in allowed_emails
        if not (user.is_active and user.is_staff and user.is_superuser and is_allowed):
            raise serializers.ValidationError("Esta cuenta no tiene acceso a Gummy Lover's.")

        attrs["user"] = user
        return attrs
