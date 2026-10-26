from django.urls import path

from . import account, extra, recovery, views

urlpatterns = [
    path("login/", views.LoginView.as_view()),
    path("register/", views.register),
    path("campuses/", views.campuses),
    path("stalls/", views.stalls),
    path("stalls/<int:pk>/like/", views.like_stall),
    path("recommend/", extra.recommend),
    # stall admin
    path("my-stall/", views.my_stall),
    path("my-stall/profile/", views.stall_profile),
    path("my-stall/payout/", extra.payout),
    path("my-stall/items/<int:pk>/", extra.delete_item),
    path("banks/", extra.banks),
    # orders and payments
    path("orders/", views.orders),
    path("orders/new/", extra.checkout),
    path("orders/verify/", extra.verify),
    path("orders/<int:pk>/status/", extra.set_status),
    path("checkouts/<int:pk>/", extra.checkout_detail),
    path("checkouts/<int:pk>/pay/", extra.pay),
    path("checkouts/<int:pk>/check/", extra.check),
    path("paystack/webhook/", extra.webhook),
    # profile
    path("password/forgot/", recovery.forgot_password),
    path("password/reset/", recovery.reset_password),
    path("me/", account.me),
    path("me/email/", account.email_request),
    path("me/email/verify/", account.email_verify),
    path("me/password/", account.change_password),
    path("me/export/", account.export),
    path("notifications/", account.notifications),
    path("notifications/read/", account.notifications_read),
    path("support/", account.support),
    path("support/<int:pk>/reply/", account.support_reply),
    # platform admin
    path("admin/announce/", account.announce),
    path("admin/support/", account.admin_support),
    path("admin/support/<int:pk>/reply/", account.admin_support_reply),
    path("admin/support/<int:pk>/close/", account.admin_support_close),
    path("admin/stalls/", views.admin_stalls),
    path("admin/payments/", extra.admin_payments),
    path("admin/stalls/<int:pk>/", views.admin_decide),
    path("admin/campuses/", views.admin_campus_create),
    path("admin/campuses/<int:pk>/", views.admin_campus_edit),
]