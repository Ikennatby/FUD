import re
from datetime import timedelta

from django import forms
from django.conf import settings
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import ProtectedError, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Campus, Checkout, MenuItem, Order, Stall, StallLike, User
from .notify import send_verification

TAGS = ["light", "hearty", "protein", "veggie", "fried", "spicy", "soup", "swallow", "sweet", "breakfast", "snack"]
FLOW = ["pending", "accepted", "preparing", "ready", "completed"]  # the steps of an order, in order
MAX_IMAGE = 3 * 1024 * 1024  # 3 MB per picture
MAX_DELIVERY_FEE = 50_000


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["role"] = "platform_admin" if self.user.is_superuser else self.user.role
        data["username"] = self.user.username
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


def err(msg, code=400):
    return Response({"error": msg}, status=code)


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def clean_phone(raw):
    """Tidy a Nigerian-style phone number. "" means none given, None means it isn't valid."""
    p = re.sub(r"[\s\-()]", "", str(raw or ""))
    if not p:
        return ""
    if p.startswith("0") and len(p) == 11:
        p = "+234" + p[1:]
    elif p.startswith("234") and len(p) == 13:
        p = "+" + p
    return p if re.fullmatch(r"\+\d{10,14}", p) else None


def valid_email(raw):
    try:
        validate_email(raw)
        return True
    except ValidationError:
        return False


def is_admin(u):
    return u.is_authenticated and (u.role == "platform_admin" or u.is_superuser)


# ---------- pictures ----------
def media(f):
    """The URL of an uploaded picture, or "" if there isn't one."""
    return f.url if f else ""


def pick_image(request, key):
    """Returns (file, error). file is None when nothing was uploaded under that name."""
    f = request.FILES.get(key)
    if not f:
        return None, ""
    if f.size > MAX_IMAGE:
        return None, "Pictures must be smaller than 3 MB."
    try:
        forms.ImageField().clean(f)  # makes sure it really is a picture (JPG, PNG, WebP, GIF)
    except ValidationError:
        return None, "That file isn't a valid picture. Use a JPG, PNG or WebP."
    return f, ""


def get_list(data, key):
    """A list of values from either a form upload or a JSON body."""
    if hasattr(data, "getlist"):
        return data.getlist(key)
    v = data.get(key) or []
    return v if isinstance(v, list) else [v]


# ---------- json shapes ----------
def campus_json(c):
    return {"id": c.id, "name": c.name, "picture": media(c.picture), "stalls": c.stalls.filter(approved=True).count()}


def like_stats(s):
    """(number of students who favourited the stall, that as a percentage of all students)."""
    n = s.likes.count()
    students = User.objects.filter(role="student", is_active=True).count()
    return n, (round(100 * n / students) if students else 0)


def stall_json(s, user=None):
    items = sorted((i for i in s.items.all() if i.available), key=lambda i: i.id)
    likes, percent = like_stats(s)
    liked = bool(user and user.is_authenticated and s.likes.filter(user=user).exists())
    return {
        "id": s.id, "name": s.name, "approved": s.approved, "payout_ready": bool(s.paystack_subaccount),
        "bank_name": s.bank_name, "account_last4": s.account_last4,
        "campus": s.campus_id, "campus_name": s.campus.name if s.campus else "",
        "logo": media(s.logo), "banner": media(s.banner), "delivery_fee": s.delivery_fee,
        "likes": likes, "like_percent": percent, "liked": liked,
        "items": [{"id": i.id, "name": i.name, "price": i.price, "image": media(i.image),
                   "tags": [t for t in i.tags.split(",") if t]} for i in items],
    }


def line_price(line):
    return line.price or line.item.price  # orders made before prices were saved have price 0


def order_items_total(order):
    return sum(l.qty * line_price(l) for l in order.lines.all())


def order_total(order):
    """What this stall is owed for the order: the food plus its delivery fee."""
    return order_items_total(order) + order.delivery_fee


def checkout_total(c):
    return sum(order_total(o) for o in c.orders.all())


def order_json(o, for_stall=False):
    """One stall's part of an order. for_stall adds the student's contact details (only while the order is still open)."""
    lines = [{"name": l.item.name, "qty": l.qty, "price": line_price(l), "image": media(l.item.image)} for l in o.lines.all()]
    subtotal = sum(l["qty"] * l["price"] for l in lines)
    out = {
        "id": o.id, "checkout": o.checkout_id, "stall": o.stall.name, "stall_logo": media(o.stall.logo),
        "student": o.student.username, "status": o.status, "paid": o.paid, "refunded": o.refunded,
        "created": o.created.isoformat(), "lines": lines, "subtotal": subtotal,
        "delivery_fee": o.delivery_fee, "total": subtotal + o.delivery_fee,
    }
    if for_stall:
        c = o.checkout
        is_open = o.status not in ("completed", "cancelled")
        out["phone"] = ((c.phone if c else "") or o.student.phone) if is_open else ""
        out["pickup"] = (c.pickup if c else "") if is_open else ""
        out["lat"] = c.lat if c and is_open else None
        out["lng"] = c.lng if c and is_open else None
    return out


def overall_status(c, parts):
    """The status of the whole checkout: the part that is furthest behind decides."""
    if not c.paid:
        return "awaiting_payment"
    live = [p["status"] for p in parts if p["status"] != "cancelled"]
    if not live:
        return "cancelled"
    return min(live, key=lambda s: FLOW.index(s) if s in FLOW else 0)


def checkout_json(c, events=False):
    ordered = sorted(c.orders.all(), key=lambda o: o.id)
    parts = [order_json(o) for o in ordered]
    if events:
        for p, o in zip(parts, ordered):
            p["events"] = [{"status": e.status, "at": e.created.isoformat()} for e in sorted(o.events.all(), key=lambda e: e.id)]
    status = overall_status(c, parts)
    subtotal, delivery = sum(p["subtotal"] for p in parts), sum(p["delivery_fee"] for p in parts)
    return {
        "id": c.id, "campus": c.campus.name if c.campus else "", "created": c.created.isoformat(),
        "paid": c.paid, "phone": c.phone, "pickup": c.pickup, "lat": c.lat, "lng": c.lng,
        "status": status, "active": status not in ("completed", "cancelled"),
        "refunded": bool(parts) and all(p["refunded"] for p in parts),
        "parts": parts, "subtotal": subtotal, "delivery_fee": delivery, "total": subtotal + delivery,
    }


def ensure_checkout(order):
    """Orders made before combined checkouts existed get their own Checkout, so everything can be shown the same way."""
    if order.checkout_id:
        return order.checkout
    c = Checkout.objects.create(student=order.student, campus=order.stall.campus, phone=order.student.phone,
                                reference=order.reference, paid=order.paid)
    Checkout.objects.filter(pk=c.pk).update(created=order.created)
    order.checkout = c
    order.save(update_fields=["checkout"])
    return c


# ---------- sign-up and public lists ----------
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register(request):
    d = request.data
    username = str(d.get("username") or "").strip()
    password = str(d.get("password") or "")
    email = str(d.get("email") or "").strip().lower()
    role = d.get("role", "student")
    if role not in ("student", "stall_admin"):
        return err("Choose student or stall admin.")
    if not username or len(password) < 8:
        return err("Enter a username and a password of at least 8 characters.")
    try:
        UnicodeUsernameValidator()(username)
    except ValidationError:
        return err("Usernames can only use letters, numbers and @ . + - _ (no spaces).")
    if len(username) > 150 or User.objects.filter(username__iexact=username).exists():
        return err("That username is taken.")
    if not valid_email(email):
        return err("Enter a valid email address. We'll send you a code to confirm it.")
    if User.objects.filter(email__iexact=email).exists():
        return err("That email is already used by another account.")
    phone = clean_phone(d.get("phone"))
    if phone is None:
        return err("Enter a valid phone number, like 0803 123 4567, or leave it blank.")
    campus = None
    if role == "stall_admin":
        campus = Campus.objects.filter(pk=to_int(d.get("campus"))).first()
        if not campus:
            return err("Choose the campus your stall is on.")
    user = User.objects.create_user(username=username, password=password, role=role, email=email, phone=phone)
    if role == "stall_admin":
        Stall.objects.create(owner=user, campus=campus, name=(str(d.get("stall_name") or "").strip() or username)[:100])
    sent, code = send_verification(user, email)
    out = {"ok": True, "email_sent": sent}
    if settings.DEBUG and "console" in settings.EMAIL_BACKEND:
        out["dev_code"] = code  # local testing only: the code is also printed in the backend terminal
    return Response(out, status=201)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def campuses(request):
    return Response([campus_json(c) for c in Campus.objects.all()])


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def stalls(request):
    qs = Stall.objects.filter(approved=True).select_related("campus").prefetch_related("items")
    campus = to_int(request.query_params.get("campus"))
    if campus:
        qs = qs.filter(campus_id=campus)
    return Response([stall_json(s, request.user) for s in qs])


@api_view(["POST"])
def like_stall(request, pk):
    """Toggle a stall as one of the student's favourites."""
    if request.user.role != "student" or request.user.is_superuser:
        return err("Only students can favourite stalls.", 403)
    stall = get_object_or_404(Stall, pk=pk, approved=True)
    _, created = StallLike.objects.get_or_create(user=request.user, stall=stall)
    if not created:
        StallLike.objects.filter(user=request.user, stall=stall).delete()
    likes, percent = like_stats(stall)
    return Response({"liked": created, "likes": likes, "like_percent": percent})


# ---------- stall owner ----------
def my_stall_or_none(user):
    stall = getattr(user, "stall", None)
    return stall if user.role == "stall_admin" and stall else None


@api_view(["GET", "POST"])
def my_stall(request):
    stall = my_stall_or_none(request.user)
    if not stall:
        return err("Only stall admins can use this.", 403)
    if request.method == "POST":
        name = str(request.data.get("name") or "").strip()[:100]
        price = to_int(request.data.get("price"))
        if not name or not 0 < price <= 1_000_000:
            return err("Enter an item name and a price in naira.")
        image, bad = pick_image(request, "image")
        if bad:
            return err(bad)
        tags = ",".join(t for t in get_list(request.data, "tags") if t in TAGS)
        item = MenuItem(stall=stall, name=name, price=price, tags=tags)
        if image:
            item.image = image
        item.save()
    return Response(stall_json(stall, request.user))


@api_view(["POST"])
def stall_profile(request):
    """The stall's delivery fee, logo and banner."""
    stall = my_stall_or_none(request.user)
    if not stall:
        return err("Only stall admins can use this.", 403)
    fee = None
    if "delivery_fee" in request.data:
        fee = to_int(request.data.get("delivery_fee"), -1)
        if not 0 <= fee <= MAX_DELIVERY_FEE:
            return err(f"Enter a delivery fee from 0 to {MAX_DELIVERY_FEE:,} naira.")
    pictures = {}
    for key in ("logo", "banner"):
        f, bad = pick_image(request, key)
        if bad:
            return err(bad)
        if f:
            pictures[key] = f
    if fee is not None:
        stall.delivery_fee = fee
    for key, f in pictures.items():
        setattr(stall, key, f)
    stall.save()
    return Response(stall_json(stall, request.user))


# ---------- orders ----------
@api_view(["GET"])
def orders(request):
    u = request.user
    if u.role == "stall_admin":  # stalls see their own part of each paid order, with the student's contact details
        qs = (Order.objects.filter(stall__owner=u, paid=True)
              .select_related("stall", "student", "checkout").prefetch_related("lines__item"))
        return Response([order_json(o, for_stall=True) for o in qs.order_by("-created")[:200]])
    for o in Order.objects.filter(student=u, checkout__isnull=True).select_related("stall", "student", "stall__campus"):
        ensure_checkout(o)
    recent = timezone.now() - timedelta(hours=24)  # hide checkouts abandoned over a day ago
    qs = (Checkout.objects.filter(student=u).filter(Q(paid=True) | Q(created__gte=recent))
          .select_related("campus").prefetch_related("orders__lines__item", "orders__stall", "orders__student"))
    return Response([checkout_json(c) for c in qs.order_by("-created")])


# ---------- platform admin ----------
@api_view(["GET"])
def admin_stalls(request):
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    qs = Stall.objects.order_by("approved", "id").select_related("campus").prefetch_related("items")
    return Response([stall_json(s) for s in qs])


@api_view(["POST"])
def admin_decide(request, pk):
    """Approve or revoke a stall, and/or move it to another campus."""
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    stall = get_object_or_404(Stall, pk=pk)
    if "campus" in request.data:
        campus = Campus.objects.filter(pk=to_int(request.data.get("campus"))).first()
        if not campus:
            return err("That campus doesn't exist.")
        stall.campus = campus
    if "approved" in request.data:
        stall.approved = bool(request.data.get("approved"))
    stall.save()
    return Response(stall_json(stall))


@api_view(["POST"])
def admin_campus_create(request):
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    name = str(request.data.get("name") or "").strip()[:120]
    if not name:
        return err("Enter the campus name.")
    if Campus.objects.filter(name__iexact=name).exists():
        return err("A campus with that name already exists.")
    picture, bad = pick_image(request, "picture")
    if bad:
        return err(bad)
    campus = Campus(name=name)
    if picture:
        campus.picture = picture
    campus.save()
    return Response(campus_json(campus), status=201)


@api_view(["POST", "DELETE"])
def admin_campus_edit(request, pk):
    """POST renames the campus and/or replaces its picture. DELETE removes it (only if no stall is on it)."""
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    campus = get_object_or_404(Campus, pk=pk)
    if request.method == "DELETE":
        try:
            campus.delete()
        except ProtectedError:
            return err("Move this campus's stalls to another campus first.")
        return Response({"ok": True})
    name = str(request.data.get("name") or campus.name).strip()[:120]
    if Campus.objects.filter(name__iexact=name).exclude(pk=pk).exists():
        return err("A campus with that name already exists.")
    picture, bad = pick_image(request, "picture")
    if bad:
        return err(bad)
    campus.name = name
    if picture:
        campus.picture = picture
    campus.save()
    return Response(campus_json(campus))