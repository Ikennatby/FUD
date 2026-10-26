import hashlib, hmac, json, logging, os, urllib.error, urllib.request, uuid

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .models import Checkout, MenuItem, Order, OrderEvent, OrderItem, Stall
from .notify import notify
from .views import (FLOW, checkout_json, checkout_total, clean_phone, ensure_checkout, err, is_admin, order_json,
                    order_total, to_int)

logger = logging.getLogger(__name__)
MAX_LINES, MAX_QTY, MAX_STALLS = 30, 20, 5  # a Paystack split can share a payment between a few stalls


# ---------- Paystack ----------
def paystack(path, payload=None, method=None):
    if not settings.PAYSTACK_SECRET_KEY:
        raise ValueError("Paystack is not set up. Add PAYSTACK_SECRET_KEY to backend/.env and restart the server.")
    req = urllib.request.Request(
        "https://api.paystack.co" + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "FUD/1.0",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "ignore")
        try:
            msg = json.loads(raw).get("message")
        except Exception:
            msg = None
        raise ValueError(msg or f"Paystack error {e.code}: {raw[:150]}")
    except urllib.error.URLError:
        raise ValueError("Could not reach Paystack. Check the internet connection.")


@api_view(["GET"])
def banks(request):
    try:
        data = paystack("/bank?country=nigeria&perPage=100")["data"]
    except ValueError as e:
        return err(str(e), 502)
    return Response([{"name": b["name"], "code": b["code"]} for b in data])


@api_view(["POST"])
def payout(request):
    """Stall admin saves bank details; Paystack creates (or updates) the stall's subaccount."""
    stall = getattr(request.user, "stall", None)
    if request.user.role != "stall_admin" or not stall:
        return err("Only stall admins can use this.", 403)
    code, number = str(request.data.get("bank_code") or ""), str(request.data.get("account_number") or "")
    if not code or not number.isdigit() or len(number) != 10:
        return err("Choose your bank and enter a 10-digit account number.")
    body = {"business_name": stall.name, "settlement_bank": code, "account_number": number,
            "percentage_charge": settings.PLATFORM_FEE_PERCENT}
    try:
        if stall.paystack_subaccount:
            try:
                res = paystack(f"/subaccount/{stall.paystack_subaccount}", body, method="PUT")
            except ValueError as e:
                if "not found" not in str(e).lower():
                    raise
                # The saved subaccount belongs to a different Paystack key (for example test vs live) or was deleted, so make a new one.
                res = paystack("/subaccount", body)
        else:
            res = paystack("/subaccount", body)
    except ValueError as e:
        return err(str(e), 502)
    stall.paystack_subaccount = res["data"]["subaccount_code"]
    stall.bank_name = str(request.data.get("bank_name") or "")[:80]
    stall.account_last4 = number[-4:]
    stall.save()
    return Response({"ok": True})


def kobo(c):
    """What the whole checkout costs, in kobo (Paystack counts in kobo)."""
    return checkout_total(c) * 100


def log(order, status):
    OrderEvent.objects.create(order=order, status=status)


def mark_paid(c):
    """The payment for a checkout went through: send every stall its part of the order."""
    if c.paid or not Checkout.objects.filter(pk=c.pk, paid=False).update(paid=True):  # only one caller wins this
        return
    c.paid = True
    parts = list(c.orders.select_related("stall__owner"))
    for o in parts:
        o.paid, o.status = True, "pending"
        o.save(update_fields=["paid", "status"])
        log(o, "pending")
    names = ", ".join(o.stall.name for o in parts)
    notify(c.student, f"Payment received: {names}",
           f"Your order of ₦{checkout_total(c):,} is with the stall{'s' if len(parts) > 1 else ''}. We'll tell you as it moves along.",
           f"/orders/{c.id}", email=True)
    for o in parts:
        notify(o.stall.owner, "New paid order",
               f"{c.student.username} ordered ₦{order_total(o):,} (food and delivery). Phone: {c.phone}. Open your stall page to accept it.",
               "/stall", email=True)


def start_payment(c, user):
    """Get a Paystack checkout link. Each attempt uses a fresh reference because Paystack won't reuse one."""
    c.reference = uuid.uuid4().hex
    c.save(update_fields=["reference"])
    parts = list(c.orders.select_related("stall"))
    payload = {
        "email": user.email or f"user{user.id}@fud-orders.com",
        "amount": kobo(c),
        "reference": c.reference,
        "callback_url": f"{settings.FRONTEND_URL}/pay/verify",
        "metadata": {"checkout_id": c.id},
    }
    if len(parts) == 1:  # one stall: the money goes straight to its subaccount
        payload["subaccount"] = parts[0].stall.paystack_subaccount
        payload["bearer"] = settings.PAYSTACK_BEARER
    else:  # several stalls: one payment, split between their subaccounts (the platform keeps its percentage)
        shares = []
        for o in parts:
            owed = order_total(o) * 100
            shares.append({"subaccount": o.stall.paystack_subaccount,
                           "share": owed - round(owed * settings.PLATFORM_FEE_PERCENT / 100)})
        payload["split"] = {"type": "flat",
                            "bearer_type": "account" if settings.PAYSTACK_BEARER == "account" else "all-proportional",
                            "subaccounts": shares}
    res = paystack("/transaction/initialize", payload)
    return res["data"]["authorization_url"]


def confirm(c):
    """Ask Paystack what happened to this checkout's payment. Returns "paid" or a message for the student."""
    if c.paid:
        return "paid"
    if not c.reference:
        return "This order has no payment yet."
    try:
        d = paystack(f"/transaction/verify/{c.reference}")["data"]
    except ValueError as e:
        return f"Paystack hasn't confirmed this payment yet ({e})."
    status = d.get("status")
    if status == "success":
        if d.get("amount") == kobo(c):
            parts = list(c.orders.select_related("stall"))
            if len(parts) == 1:
                routed = (d.get("subaccount") or {}).get("subaccount_code") or ""
                if routed != parts[0].stall.paystack_subaccount:  # the money did not go to the stall: leave a trace
                    logger.warning("Checkout %s was paid, but Paystack routed it to %r instead of %r",
                                   c.id, routed, parts[0].stall.paystack_subaccount)
            mark_paid(c)
            return "paid"
        return "The amount paid doesn't match this order. Please contact the stall and don't pay again."
    if status in ("abandoned", "failed", "reversed"):
        return "The payment wasn't completed. You can try again."
    return "The payment is still being processed. Check again in a minute."


def find_checkout(reference, user=None):
    """Look a checkout up by its Paystack reference (also finds orders made before checkouts existed)."""
    if not reference:
        return None
    mine = {"student": user} if user else {}
    c = Checkout.objects.filter(reference=reference, **mine).first()
    if c:
        return c
    o = Order.objects.filter(reference=reference, checkout__isnull=True, **mine).select_related("stall", "student").first()
    return ensure_checkout(o) if o else None


def coords(lat, lng):
    """Latitude and longitude from the browser, or (None, None) if missing or nonsense."""
    try:
        la, lo = float(lat), float(lng)
    except (TypeError, ValueError):
        return None, None
    if -90 <= la <= 90 and -180 <= lo <= 180:
        return round(la, 6), round(lo, 6)
    return None, None


@api_view(["POST"])
def checkout(request):
    """Place one order for everything in the cart. It can include several stalls on the same campus."""
    u, d = request.user, request.data
    if u.role != "student":
        return err("Only students can place orders.", 403)
    lines = d.get("lines")
    if not isinstance(lines, list) or not 0 < len(lines) <= MAX_LINES or not all(isinstance(l, dict) for l in lines):
        return err("Add between 1 and 30 items.")
    wanted = {}
    for l in lines:
        item_id = to_int(l.get("item"))
        wanted[item_id] = min(wanted.get(item_id, 0) + max(1, to_int(l.get("qty"), 1)), MAX_QTY)
    items = {i.id: i for i in MenuItem.objects.filter(id__in=list(wanted), available=True, stall__approved=True)
             .select_related("stall", "stall__campus")}
    if len(items) != len(wanted):
        return err("Some items are no longer available. Refresh the menu and try again.")
    stalls = {i.stall_id: i.stall for i in items.values()}
    if len(stalls) > MAX_STALLS:
        return err(f"You can order from up to {MAX_STALLS} stalls at once.")
    campuses = {s.campus_id for s in stalls.values()}
    if len(campuses) != 1 or None in campuses:
        return err("Everything in one order must come from stalls on the same campus.")
    live = bool(settings.PAYSTACK_SECRET_KEY)
    if not live and not settings.DEBUG:
        return err("Payments are not set up yet.", 503)
    if live:
        missing = [s.name for s in stalls.values() if not s.paystack_subaccount]
        if missing:
            return err(f"{', '.join(missing)} hasn't added a bank account yet, so can't take orders.")
    phone = clean_phone(d.get("phone") or u.phone)
    if not phone:
        return err("Enter a phone number the stall can call you on, like 0803 123 4567.")
    pickup = str(d.get("pickup") or "").strip()[:300]
    if len(pickup) < 3:
        return err("Describe where you'll collect your order, like \"Block C gate\" or \"Hostel 4, room 12\".")
    lat, lng = coords(d.get("lat"), d.get("lng"))
    with transaction.atomic():
        c = Checkout.objects.create(
            student=u, campus=next(iter(stalls.values())).campus, phone=phone, pickup=pickup, lat=lat, lng=lng,
            reference=("" if live else "test-") + uuid.uuid4().hex)
        for stall in stalls.values():
            o = Order.objects.create(student=u, stall=stall, checkout=c, delivery_fee=stall.delivery_fee)
            OrderItem.objects.bulk_create(
                [OrderItem(order=o, item=items[i], qty=q, price=items[i].price) for i, q in wanted.items()
                 if items[i].stall_id == stall.id])
            log(o, "awaiting_payment")
    if not live:  # local testing only: no money moves
        mark_paid(c)
        return Response({"checkout": checkout_json(c), "test_mode": True}, status=201)
    try:
        url = start_payment(c, u)
    except ValueError as e:
        c.delete()
        return err(str(e), 502)
    return Response({"authorization_url": url, "checkout_id": c.id}, status=201)


@api_view(["POST"])
def pay(request, pk):
    """Resume payment for a checkout that was created but not paid."""
    c = get_object_or_404(Checkout, pk=pk, student=request.user)
    if confirm(c) == "paid":  # it may have gone through after all
        return Response({"checkout": checkout_json(c), "paid": True})
    if any(not o.stall.paystack_subaccount for o in c.orders.select_related("stall")):
        return err("One of these stalls hasn't added a bank account yet, so it can't take orders.")
    try:
        url = start_payment(c, request.user)
    except ValueError as e:
        return err(str(e), 502)
    return Response({"authorization_url": url})


@api_view(["POST"])
def check(request, pk):
    c = get_object_or_404(Checkout, pk=pk, student=request.user)
    msg = confirm(c)
    return Response({**checkout_json(c), "payment": msg})


@api_view(["GET"])
def verify(request):
    """Where Paystack sends the student back to after paying."""
    ref = request.query_params.get("reference") or request.query_params.get("trxref") or ""
    if not ref:
        return err("No payment reference found.")
    c = find_checkout(ref, request.user)
    if not c:
        return err("We couldn't find that payment.", 404)
    msg = confirm(c)
    return Response({**checkout_json(c), "payment": msg})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def webhook(request):
    """Paystack calls this even if the student closes the tab. Set it in the Paystack dashboard."""
    key = settings.PAYSTACK_SECRET_KEY
    mac = hmac.new(key.encode(), request.body, hashlib.sha512).hexdigest() if key else ""
    if not key or not hmac.compare_digest(mac, request.headers.get("x-paystack-signature", "")):
        return Response(status=401)
    try:
        ev = json.loads(request.body)
    except ValueError:
        return Response(status=400)
    if ev.get("event") == "charge.success":
        data = ev.get("data") or {}
        c = find_checkout(data.get("reference", ""))
        if c and not c.paid and data.get("amount") == kobo(c):
            mark_paid(c)
    return Response(status=200)


# ---------- Order status ----------
MESSAGES = {
    "accepted": ("Order accepted", "{stall} accepted your order."),
    "preparing": ("Your food is being prepared", "{stall} has started on your order."),
    "ready": ("Your order is ready", "Come and collect it from {stall}."),
    "completed": ("Order completed", "Enjoy your meal from {stall}!"),
    "cancelled": ("Order cancelled", "{stall} cancelled their part of your order. {refund}"),
}


@api_view(["POST"])
def set_status(request, pk):
    """A stall moves its part of an order along (or cancels it, which refunds just that part)."""
    o = get_object_or_404(Order.objects.select_related("stall", "student", "checkout"), pk=pk, stall__owner=request.user, paid=True)
    c = o.checkout or ensure_checkout(o)
    new = request.data.get("status")
    if o.status in ("completed", "cancelled"):
        return err("This order is already closed.")
    if new != "cancelled" and (new not in FLOW or FLOW.index(new) <= FLOW.index(o.status)):
        return err("Pick the next step for this order.")
    refund_error = ""
    if new == "cancelled" and settings.PAYSTACK_SECRET_KEY and not c.reference.startswith("test-"):
        try:  # give the student back the money for this stall's part only
            paystack("/refund", {"transaction": c.reference, "amount": order_total(o) * 100})
            o.refunded = True
        except ValueError as e:
            refund_error = str(e)
    o.status = new
    o.save()
    log(o, new)
    title, text = MESSAGES[new]
    refund = "Your refund has been requested from Paystack." if o.refunded else "If you were charged and don't get a refund, contact support."
    notify(o.student, title, text.format(stall=o.stall.name, refund=refund), f"/orders/{c.id}", email=True)
    return Response({**order_json(o, for_stall=True), "refund_error": refund_error})


# ---------- Meal recommendations (rule-based) ----------
GOAL = {"weight_loss": {"light": 2, "veggie": 1, "fried": -2, "hearty": -1},
        "muscle_gain": {"protein": 3, "hearty": 1},
        "balanced": {"veggie": 1, "protein": 1}}
HEALTH = {"none": {},
          "diabetes": {"sweet": -3, "hearty": -1, "veggie": 1},
          "hypertension": {"fried": -2, "spicy": -1, "veggie": 1},
          "ulcer": {"spicy": -3, "fried": -2, "soup": 1}}
MEAL = {"breakfast": {"breakfast": 3, "hearty": -1}, "lunch": {"hearty": 1, "soup": 1},
        "dinner": {"light": 1, "soup": 1}, "snack": {"snack": 3, "hearty": -1}}
WHY = {"light": "light on the stomach", "veggie": "has vegetables", "protein": "high in protein",
       "hearty": "filling", "soup": "soup-based", "breakfast": "a breakfast food", "snack": "a good snack"}


def default_meal():
    h = timezone.localtime().hour
    return "breakfast" if h < 11 else "lunch" if h < 16 else "dinner" if h < 21 else "snack"


def claude_note(picks, ctx):
    """Optional: a friendly summary from Claude when ANTHROPIC_API_KEY is set. Cached so the public page can't run up your bill."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not picks:
        return ""
    cache_key = "note:" + hashlib.md5(json.dumps([ctx, [p["id"] for p in picks]], sort_keys=True).encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    prompt = (f"In two friendly sentences, tell a Nigerian university student why these meals suit them. "
              f"Context: {json.dumps(ctx)}. Meals: {', '.join(p['name'] for p in picks)}. No medical claims.")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps({"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5"), "max_tokens": 200,
                         "messages": [{"role": "user", "content": prompt}]}).encode(),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            note = json.load(r)["content"][0]["text"]
    except Exception:
        note = ""
    cache.set(cache_key, note, 600 if note else 60)
    return note


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def recommend(request):
    q = request.query_params
    budget = to_int(q.get("budget") or "0", -1)  # blank means no limit; text or negatives are errors
    if budget < 0:
        return err("Budget must be a number in naira.")
    health, goal, meal = q.get("health", "none"), q.get("goal", "balanced"), q.get("meal") or default_meal()
    if health not in HEALTH or goal not in GOAL or meal not in MEAL:
        return err("Unknown option.")
    picks = []
    items = MenuItem.objects.filter(stall__approved=True, available=True).select_related("stall")
    campus = to_int(q.get("campus"))
    if campus:  # only suggest meals from the campus the student is ordering from
        items = items.filter(stall__campus_id=campus)
    for i in items:
        if budget and i.price > budget:
            continue
        score, why = 0, []
        for table in (GOAL[goal], HEALTH[health], MEAL[meal]):
            for t in filter(None, i.tags.split(",")):
                w = table.get(t, 0)
                score += w
                if w > 0 and t in WHY and WHY[t] not in why:
                    why.append(WHY[t])
        if score >= 0:
            picks.append({"id": i.id, "name": i.name, "price": i.price, "stall": i.stall.name,
                          "score": score, "why": why})
    picks = sorted(picks, key=lambda p: (-p["score"], p["price"]))[:5]
    # AI tips only for signed-in people who switched them on in Privacy (their choices are sent to Anthropic)
    ai_ok = request.user.is_authenticated and request.user.consent_ai
    note = claude_note(picks, {"budget": budget, "health": health, "goal": goal, "meal": meal}) if ai_ok else ""
    return Response({"meal": meal, "picks": picks, "note": note,
                     "ai_hint": bool(os.environ.get("ANTHROPIC_API_KEY")) and not ai_ok})


# ---------- Menu ----------
@api_view(["DELETE"])
def delete_item(request, pk):
    item = get_object_or_404(MenuItem, pk=pk, stall__owner=request.user)
    try:
        item.delete()
    except ProtectedError:  # it has past orders, so hide it instead
        item.available = False
        item.save()
    return Response({"ok": True})


# ---------- Order tracker (student) ----------
@api_view(["GET"])
def checkout_detail(request, pk):
    qs = Checkout.objects.select_related("campus").prefetch_related(
        "orders__lines__item", "orders__stall", "orders__student", "orders__events")
    c = get_object_or_404(qs, pk=pk, student=request.user)
    return Response(checkout_json(c, events=True))


# ---------- Where did the money go? (platform admin) ----------
@api_view(["GET"])
def admin_payments(request):
    """Ask Paystack, for each recent real payment, which subaccount it was routed to."""
    if not is_admin(request.user):
        return err("Platform admins only.", 403)
    rows = []
    recent = Checkout.objects.filter(paid=True).exclude(reference__startswith="test-").prefetch_related("orders__stall", "orders__lines")
    for c in recent.order_by("-created")[:10]:
        stalls = [o.stall for o in c.orders.all()]
        row = {"order": c.id, "stall": ", ".join(s.name for s in stalls), "amount": checkout_total(c),
               "expected": ", ".join(s.paystack_subaccount for s in stalls)}
        try:
            d = paystack(f"/transaction/verify/{c.reference}")["data"]
            row["mode"] = d.get("domain") or ""
            if len(stalls) == 1:
                sub = d.get("subaccount") or {}
                row["routed_to"] = sub.get("subaccount_code") or ""
                row["bank"] = f"{sub.get('settlement_bank') or ''} ending {str(sub.get('account_number') or '')[-4:]}".strip() if sub else ""
                row["ok"] = bool(row["routed_to"]) and row["routed_to"] == row["expected"]
            else:  # one payment shared between several stalls
                row["routed_to"] = "split" if d.get("split") else ""
                row["bank"] = f"split between {len(stalls)} stalls"
                row["ok"] = bool(d.get("split"))
        except ValueError as e:
            row["error"] = str(e)
            row["ok"] = False
        rows.append(row)
    payouts = []  # what Paystack has settled (or queued) to each stall's bank account
    for s in Stall.objects.exclude(paystack_subaccount="").order_by("id"):
        entry = {"stall": s.name, "bank": f"{s.bank_name} ending {s.account_last4}", "settlements": []}
        try:
            for st in paystack(f"/settlement?subaccount={s.paystack_subaccount}&perPage=5")["data"] or []:
                amount = (st.get("effective_amount") or st.get("total_processed") or 0) // 100
                date = str(st.get("settlement_date") or st.get("settled_date") or st.get("createdAt") or "")[:10]
                entry["settlements"].append({"status": st.get("status") or "", "amount": amount, "date": date})
        except ValueError as e:
            entry["error"] = str(e)
        payouts.append(entry)
    mode = "live" if settings.PAYSTACK_SECRET_KEY.startswith("sk_live_") else "test"
    return Response({"mode": mode, "rows": rows, "payouts": payouts})