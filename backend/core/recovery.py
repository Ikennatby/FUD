"""Forgot password: a 6-digit code is emailed, then the person chooses a new password."""
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .models import ResetCode, User
from .notify import hash_code, notify, send_email
from .views import err

CODE_MINUTES = 15


@api_view(["POST"])
@authentication_classes([])  # works even if the browser still holds an old, expired login
@permission_classes([permissions.AllowAny])
def forgot_password(request):
    """Email a reset code. The answer is the same whether or not an account has that email, so nobody can probe for accounts."""
    email = str(request.data.get("email") or "").strip().lower()
    out = {"ok": True}
    user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
    if user:
        last = ResetCode.objects.filter(user=user).order_by("-created").first()
        if last and timezone.now() - last.created < timedelta(seconds=60):
            return Response(out)  # one code a minute is plenty
        ResetCode.objects.filter(user=user, used=False).update(used=True)
        code = f"{secrets.randbelow(1_000_000):06d}"
        ResetCode.objects.create(user=user, code_hash=hash_code(code))
        send_email(user.email, "Reset your FÜD password",
                   [f"Your password reset code is {code}.",
                    f"It expires in {CODE_MINUTES} minutes. If you didn't ask for it, ignore this email and your password stays the same."],
                   "Reset your password")
        if settings.DEBUG and "console" in settings.EMAIL_BACKEND:
            out["dev_code"] = code  # local testing only: the code is also printed in the backend terminal
    return Response(out)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    d = request.data
    email = str(d.get("email") or "").strip().lower()
    code = str(d.get("code") or "").strip()
    new = str(d.get("new_password") or "")
    if len(new) < 8:
        return err("Choose a password of at least 8 characters.")
    bad = "That code isn't right or has expired. Ask for a new one."
    user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
    rec = ResetCode.objects.filter(user=user, used=False).order_by("-created").first() if user else None
    if not rec or rec.attempts >= 5 or timezone.now() - rec.created > timedelta(minutes=CODE_MINUTES):
        return err(bad)
    rec.attempts += 1
    if not hmac.compare_digest(rec.code_hash, hash_code(code)):
        rec.save(update_fields=["attempts"])
        return err(bad)
    rec.used = True
    rec.save(update_fields=["attempts", "used"])
    user.set_password(new)
    user.email_verified = True  # they just proved they can read this inbox
    user.save()
    notify(user, "Your password was changed", "If this wasn't you, contact support straight away.", email=True)
    return Response({"ok": True})