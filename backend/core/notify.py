"""Emails, verification codes and in-app notifications."""
import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

from django.db.models import Q

from .models import EmailCode, Notification, User

log = logging.getLogger(__name__)


def email_html(title, lines):
    body = "".join(
        f'<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#14231a">{escape(l)}</p>' for l in lines)
    return (
        '<div style="background:#f5f7f1;padding:24px;font-family:Arial,Helvetica,sans-serif">'
        '<div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e1e7da">'
        '<div style="background:#14532d;padding:18px 24px;color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">'
        'F<span style="color:#f2a900">&middot;</span>UD</div>'
        f'<div style="padding:24px"><h2 style="margin:0 0 14px;color:#14532d;font-size:20px">{escape(title)}</h2>{body}</div>'
        '<div style="padding:14px 24px;background:#f5f7f1;color:#5d6b62;font-size:12px">'
        'You are getting this because of the settings on your FÜD account. You can change them in Profile → Notifications.</div>'
        '</div></div>')


def send_email(to, subject, lines, title=None, connection=None):
    """Send a branded email. Returns True if it went out."""
    try:
        msg = EmailMultiAlternatives(subject, "\n\n".join(lines), settings.DEFAULT_FROM_EMAIL, [to], connection=connection)
        msg.attach_alternative(email_html(title or subject, lines), "text/html")
        msg.send()
        return True
    except Exception:
        log.exception("Could not send email to %s", to)
        return False


def notify(user, title, body="", link="", email=False):
    """Tell a user something: in-app (if they allow it) and by email (if verified and allowed)."""
    if not user.is_active:
        return
    if user.notify_inapp:
        Notification.objects.create(user=user, title=title[:120], body=body[:300], link=link[:120])
    if email and user.email and user.email_verified and user.notify_email:
        send_email(user.email, title, [body or title], title)


def hash_code(code):
    return hashlib.sha256((settings.SECRET_KEY + code).encode()).hexdigest()


def send_verification(user, email):
    """Email a fresh 6-digit code. Returns (sent, code)."""
    EmailCode.objects.filter(user=user, used=False).update(used=True)
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailCode.objects.create(user=user, email=email, code_hash=hash_code(code))
    sent = send_email(email, "Your FÜD verification code",
                      [f"Your verification code is {code}.", "It expires in 15 minutes. If you didn't ask for it, you can ignore this email."],
                      "Verify your email")
    return sent, code


def check_code(user, code):
    """Returns (record, error_message)."""
    rec = EmailCode.objects.filter(user=user, used=False).order_by("-created").first()
    if not rec or timezone.now() - rec.created > timedelta(minutes=15):
        return None, "That code has expired. Ask for a new one."
    if rec.attempts >= 5:
        return None, "Too many wrong tries. Ask for a new code."
    rec.attempts += 1
    if not hmac.compare_digest(rec.code_hash, hash_code(str(code).strip())):
        rec.save()
        return None, "That code isn't right."
    rec.used = True
    rec.save()
    return rec, ""


def notify_admins(title, body="", link=""):
    """Tell every platform admin (in the app, and by email if their address is verified)."""
    for u in User.objects.filter(is_active=True).filter(Q(is_superuser=True) | Q(role="platform_admin")):
        notify(u, title, body, link, email=True)
