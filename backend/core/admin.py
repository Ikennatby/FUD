from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (Campus, Checkout, MenuItem, Notification, Order, OrderEvent, OrderItem, Stall, StallLike,
                     SupportMessage, SupportTicket, User)


class FudUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("FÜD", {"fields": (
        "role", "phone", "email_verified", "notify_email", "notify_inapp", "notify_browser", "notify_promos",
        "consent_ai", "consent_analytics", "consent_updated")}),)
    list_display = ("username", "email", "role", "email_verified", "is_active")


class MessageInline(admin.TabularInline):
    model = SupportMessage
    extra = 0
    readonly_fields = ("created",)


@admin.register(SupportTicket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "user", "status", "updated")
    list_filter = ("status",)
    inlines = [MessageInline]


admin.site.register(User, FudUserAdmin)
admin.site.register([Campus, Stall, StallLike, MenuItem, Checkout, Order, OrderItem, OrderEvent, Notification])