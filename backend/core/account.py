"""Profile, notifications, support chat, announcements and data export."""
from datetime import timedelta

from django.conf import settings
from django.core.mail import get_connection
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import EmailCode, Notification, Order, SupportMessage, SupportTicket, User
from .notify import check_code, notify, notify_admins, send_email, send_verification
from .views import clean_phone, err, is_admin, order_json, valid_email

PREFS = ["notify_email", "notify_inapp", "notify_browser", "notify_promos"]
CONSENTS = ["consent_ai", "consent_analytics"]


def me_json(u):
    return {
        "username": u.username, "role": "platform_admin" if u.is_superuser else u.role,
        "email": u.email, "email_verified": u.email_verified, "phone": u.phone,
        **{f: getattr(u, f) for f in PREFS + CONSENTS},
        "consent_updated": u.consent_updated.isoformat() if u.consent_updated else None,
        "joined": u.date_joined.isoformat(),
    }


@api_view(["GET", "PATCH", "DELETE"])
def me(request):
    u = request.user
    if request.method == "DELETE":
        return delete_account(request)
    if request.method == "PATCH":
        d = request.data
        for f in PREFS + CONSENTS:
            if f in d:
                setattr(u, f, d[f] is True or d[f] == "true")
        if any(f in d for f in CONSENTS):
            u.consent_updated = timezone.now()
        if "phone" in d:
            phone = clean_phone(d["phone"])
            if phone is None:
                return err("Enter a valid phone number, like 0803 123 4567.")
            u.phone = phone
        u.save()
    return Response(me_json(u))


def delete_account(request):
    """Remove the person's details. Paid orders stay, without their name, so stalls keep their sales records."""
    u = request.user
    if not u.check_password(str(request.data.get("password") or "")):
        return err("That password isn't right.", 403)
    if u.is_superuser:
        return err("Platform admin accounts can't be deleted here.", 403)
    busy = Order.objects.filter(paid=True).exclude(status__in=["completed", "cancelled"])
    busy = busy.filter(stall__owner=u) if u.role == "stall_admin" else busy.filter(student=u)
    if busy.exists():
        return err("You have orders in progress. Wait until they're finished or cancelled, then try again.")
    with transaction.atomic():
        Order.objects.filter(student=u, paid=False).delete()
        u.notifications.all().delete()
        u.tickets.all().delete()
        EmailCode.objects.filter(user=u).delete()
        stall = getattr(u, "stall", None)
        if stall:
            stall.approved, stall.paystack_subaccount, stall.bank_name, stall.account_last4 = False, "", "", ""
            stall.save()
        u.username, u.email, u.phone, u.first_name, u.last_name = f"deleted_{u.id}", "", "", "", ""
        for f in PREFS + CONSENTS + ["email_verified"]:
            setattr(u, f, False)
        u.is_active = False
        u.set_unusable_password()
        u.save()
    return Response({"ok": True})


# ---------- email ----------
@api_view(["POST"])
def email_request(request):
    """Send a code to a new (or the current, unverified) email address."""
    u = request.user
    email = str(request.data.get("email") or u.email).strip().lower()
    if not valid_email(email):
        return err("Enter a valid email address.")
    if User.objects.filter(email__iexact=email).exclude(pk=u.pk).exists():
        return err("That email is already used by another account.")
    last = EmailCode.objects.filter(user=u).order_by("-created").first()
    if last and timezone.now() - last.created < timedelta(seconds=60):
        return err("Please wait a minute before asking for another code.", 429)
    sent, code = send_verification(u, email)
    if not sent:
        return err("We couldn't send that email. Check the email settings on the server.", 502)
    out = {"ok": True, "email": email}
    if settings.DEBUG and "console" in settings.EMAIL_BACKEND:
        out["dev_code"] = code
    return Response(out)


@api_view(["POST"])
def email_verify(request):
    u = request.user
    rec, message = check_code(u, request.data.get("code") or "")
    if not rec:
        return err(message)
    if User.objects.filter(email__iexact=rec.email).exclude(pk=u.pk).exists():
        return err("That email is already used by another account.")
    u.email, u.email_verified = rec.email, True
    u.save()
    notify(u, "Email verified", "You'll now get order updates by email, if you have that switched on.")
    return Response(me_json(u))


@api_view(["POST"])
def change_password(request):
    u, d = request.user, request.data
    current, new = str(d.get("current_password") or ""), str(d.get("new_password") or "")
    if not u.check_password(current):
        return err("Your current password isn't right.", 403)
    if len(new) < 8:
        return err("Use at least 8 characters for the new password.")
    if new == current:
        return err("Pick a password different from your current one.")
    u.set_password(new)
    u.save()
    notify(u, "Your password was changed", "If this wasn't you, contact support straight away.", "/profile?tab=help", email=True)
    return Response({"ok": True})


# ---------- notifications ----------
@api_view(["GET"])
def notifications(request):
    qs = request.user.notifications
    items = [{"id": n.id, "title": n.title, "body": n.body, "link": n.link, "read": n.read, "created": n.created.isoformat()}
             for n in qs.order_by("-created")[:30]]
    return Response({"unread": qs.filter(read=False).count(), "items": items})


@api_view(["POST"])
def notifications_read(request):
    request.user.notifications.filter(read=False).update(read=True)
    return Response({"ok": True})


# ---------- help and support ----------
def ticket_json(t):
    msgs = [{"from_staff": m.from_staff, "text": m.text, "created": m.created.isoformat()}
            for m in sorted(t.messages.all(), key=lambda m: m.id)]
    return {
        "id": t.id, "subject": t.subject, "status": t.status, "user": t.user.username,
        "created": t.created.isoformat(), "updated": t.updated.isoformat(),
        "awaiting": bool(msgs) and not msgs[-1]["from_staff"] and t.status == "open",  # waiting for an admin reply
        "messages": msgs,
    }


def clean_text(value, limit=2000):
    return str(value or "").strip()[:limit]


@api_view(["GET", "POST"])
def support(request):
    u = request.user
    if request.method == "POST":
        subject, text = clean_text(request.data.get("subject"), 120), clean_text(request.data.get("message"))
        if not subject or not text:
            return err("Add a short title and describe the problem.")
        t = SupportTicket.objects.create(user=u, subject=subject)
        SupportMessage.objects.create(ticket=t, text=text)
        notify_admins(f"New support chat from {u.username}", f"{subject}: {text[:150]}", "/admin#support")
        return Response(ticket_json(t), status=201)
    qs = u.tickets.select_related("user").prefetch_related("messages").order_by("-updated")
    return Response([ticket_json(t) for t in qs])


@api_view(["POST"])
def support_reply(request, pk):
    t = get_object_or_404(SupportTicket, pk=pk, user=request.user)
    text = clean_text(request.data.get("message"))
    if not text:
        return err("Write a message first.")
    SupportMessage.objects.create(ticket=t, text=text)
    t.status = "open"
    t.save()
    notify_admins(f"{request.user.username} replied in support", text[:200], "/admin#support")
    return Response(ticket_json(t))


@api_view(["GET"])
def admin_support(request):
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    qs = SupportTicket.objects.select_related("user").prefetch_related("messages").order_by("-status", "-updated")[:50]
    return Response([ticket_json(t) for t in qs])


@api_view(["POST"])
def admin_support_reply(request, pk):
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    t = get_object_or_404(SupportTicket, pk=pk)
    text = clean_text(request.data.get("message"))
    if not text:
        return err("Write a reply first.")
    SupportMessage.objects.create(ticket=t, from_staff=True, text=text)
    t.status = "open"
    t.save()
    notify(t.user, "Support replied to you", text[:200], "/profile?tab=help", email=True)
    return Response(ticket_json(t))


@api_view(["POST"])
def admin_support_close(request, pk):
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    t = get_object_or_404(SupportTicket, pk=pk)
    t.status = "closed"
    t.save()
    return Response(ticket_json(t))


# ---------- announcements (platform admin) ----------
@api_view(["POST"])
def announce(request):
    """Send an update to users in-app and by email. Promotions go only to people who opted in; service notices go to everyone."""
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    d = request.data
    subject, message = clean_text(d.get("subject"), 120), clean_text(d.get("message"))
    if not subject or not message:
        return err("Add a subject and a message.")
    users = User.objects.filter(is_active=True)
    audience = d.get("audience", "all")
    if audience == "students":
        users = users.filter(role="student")
    elif audience == "stalls":
        users = users.filter(role="stall_admin")
    elif audience != "all":
        return err("Pick who should get this.")
    important = d.get("important") is True
    if not important:
        users = users.filter(notify_promos=True)
    in_app = emails = 0
    connection = get_connection()
    for u in users[:500]:
        Notification.objects.create(user=u, title=subject, body=message[:300])
        in_app += 1
        if u.email and u.email_verified and send_email(u.email, subject, [message], subject, connection=connection):
            emails += 1
    return Response({"in_app": in_app, "emails": emails})


# ---------- download my data ----------
@api_view(["GET"])
def export(request):
    u = request.user
    orders = Order.objects.filter(student=u).select_related("stall", "student").prefetch_related("lines__item")
    tickets = u.tickets.select_related("user").prefetch_related("messages")
    return Response({
        "account": me_json(u),
        "orders": [order_json(o) for o in orders],
        "support": [ticket_json(t) for t in tickets],
    })
