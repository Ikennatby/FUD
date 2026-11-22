"""Earnings tracker for stall owners: paid orders that were not cancelled, by week and by month."""
import calendar
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Order
from .views import err, my_stall_or_none, order_items_total

# Weeks are simple day ranges, so the weeks of a month always add up to exactly that month.
WEEK_DAYS = [(1, 7), (8, 14), (15, 21), (22, 28), (29, 31)]
HISTORY_MONTHS = 6


def month_key(year, month):
    return f"{year:04d}-{month:02d}"


def shift_month(year, month, delta):
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def summarize(rows, year, month, current, fee_percent):
    """rows: (local_datetime, food_naira, delivery_naira, completed) for every counted order.
    current: the "YYYY-MM" of today. Returns everything the page needs."""
    last_day = calendar.monthrange(year, month)[1]
    weeks = []
    for i, (first, last) in enumerate(WEEK_DAYS):
        if first > last_day:
            break
        weeks.append({"week": i + 1, "from": first, "to": min(last, last_day),
                      "orders": 0, "food": 0, "delivery": 0, "total": 0})
    history = {}
    for offset in range(-(HISTORY_MONTHS - 1), 1):
        y, m = shift_month(year, month, offset)
        history[month_key(y, m)] = {"month": month_key(y, m), "total": 0, "orders": 0}
    in_progress = 0
    for when, food, delivery, completed in rows:
        key = month_key(when.year, when.month)
        if key in history:
            history[key]["total"] += food + delivery
            history[key]["orders"] += 1
        if (when.year, when.month) == (year, month):
            week = weeks[min((when.day - 1) // 7, len(weeks) - 1)]
            week["orders"] += 1
            week["food"] += food
            week["delivery"] += delivery
            week["total"] += food + delivery
            if not completed:
                in_progress += food + delivery
    total = sum(w["total"] for w in weeks)
    orders = sum(w["orders"] for w in weeks)
    for w in weeks:
        w["share"] = round(100 * w["total"] / total, 1) if total else 0
    best = max(weeks, key=lambda w: w["total"]) if total else None
    return {
        "month": month_key(year, month), "current": current,
        "total": total, "orders": orders, "average": round(total / orders) if orders else 0,
        "food": sum(w["food"] for w in weeks), "delivery": sum(w["delivery"] for w in weeks),
        "in_progress": in_progress,
        "fee_percent": fee_percent, "after_fee": round(total * (100 - fee_percent) / 100),
        "best_week": best["week"] if best else None,
        "weeks": weeks, "history": list(history.values()),
    }


@api_view(["GET"])
def earnings(request):
    stall = my_stall_or_none(request.user)
    if not stall:
        return err("Only stall admins can use this.", 403)
    now = timezone.localtime()
    try:
        year, month = (int(x) for x in str(request.query_params.get("month") or "").split("-"))
        if not (2000 <= year <= 2100 and 1 <= month <= 12):
            raise ValueError
    except ValueError:
        year, month = now.year, now.month
    tz = timezone.get_current_timezone()
    fy, fm = shift_month(year, month, -(HISTORY_MONTHS - 1))
    ny, nm = shift_month(year, month, 1)
    start = timezone.make_aware(datetime(fy, fm, 1), tz)
    end = timezone.make_aware(datetime(ny, nm, 1), tz)
    qs = (Order.objects.filter(stall=stall, paid=True, created__gte=start, created__lt=end)
          .exclude(status="cancelled").prefetch_related("lines__item"))
    rows = [(timezone.localtime(o.created), order_items_total(o), o.delivery_fee, o.status == "completed") for o in qs]
    return Response(summarize(rows, year, month, month_key(now.year, now.month), settings.PLATFORM_FEE_PERCENT))