from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLES = [("student", "Student"), ("stall_admin", "Stall admin"), ("platform_admin", "Platform admin")]
    role = models.CharField(max_length=20, choices=ROLES, default="student")
    phone = models.CharField(max_length=20, blank=True, default="")
    email_verified = models.BooleanField(default=False)
    # how this person wants to hear from us
    notify_email = models.BooleanField(default=True)       # order and account emails (only sent to a verified address)
    notify_inapp = models.BooleanField(default=True)
    notify_browser = models.BooleanField(default=False)    # pop-ups while the site is open (needs browser permission)
    notify_promos = models.BooleanField(default=False)     # announcements and promotions
    # consent to optional third-party processing
    consent_ai = models.BooleanField(default=False)
    consent_analytics = models.BooleanField(default=False)
    consent_updated = models.DateTimeField(null=True, blank=True)


class Campus(models.Model):
    """A university campus. Created by the platform admin; stalls belong to one."""
    name = models.CharField(max_length=120, unique=True)
    picture = models.ImageField(upload_to="campuses/", blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "campuses"

    def __str__(self):
        return self.name


class Stall(models.Model):
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="stall")
    campus = models.ForeignKey(Campus, null=True, blank=True, on_delete=models.PROTECT, related_name="stalls")
    name = models.CharField(max_length=100)
    approved = models.BooleanField(default=False)
    logo = models.ImageField(upload_to="stalls/", blank=True)
    banner = models.ImageField(upload_to="stalls/", blank=True)
    delivery_fee = models.PositiveIntegerField(default=0, help_text="Naira, charged once per order")
    paystack_subaccount = models.CharField(max_length=60, blank=True, default="")
    bank_name = models.CharField(max_length=80, blank=True, default="")
    account_last4 = models.CharField(max_length=4, blank=True, default="")

    def __str__(self):
        return self.name


class StallLike(models.Model):
    """A student marking a stall as a favourite."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="liked_stalls")
    stall = models.ForeignKey(Stall, on_delete=models.CASCADE, related_name="likes")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "stall")


class MenuItem(models.Model):
    stall = models.ForeignKey(Stall, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=100)
    price = models.PositiveIntegerField(help_text="Naira")
    image = models.ImageField(upload_to="menu/", blank=True)
    tags = models.CharField(max_length=200, blank=True, default="")  # comma-separated, used by recommendations
    available = models.BooleanField(default=True)  # False = hidden (deleted but already ordered before)

    def __str__(self):
        return self.name


class Checkout(models.Model):
    """One payment covering everything a student put in their cart. It can hold one Order per stall."""
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="checkouts")
    campus = models.ForeignKey(Campus, null=True, blank=True, on_delete=models.SET_NULL, related_name="checkouts")
    phone = models.CharField(max_length=20, blank=True, default="")      # shared with the stalls so they can call
    pickup = models.CharField(max_length=300, blank=True, default="")    # "Block C, ground floor gate", etc.
    lat = models.FloatField(null=True, blank=True)                       # live location, only if the student allowed it
    lng = models.FloatField(null=True, blank=True)
    reference = models.CharField(max_length=40, blank=True, default="")  # Paystack reference
    paid = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)


class Order(models.Model):
    """The part of a Checkout that one stall has to prepare."""
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    stall = models.ForeignKey(Stall, on_delete=models.CASCADE, related_name="orders")
    checkout = models.ForeignKey(Checkout, null=True, blank=True, on_delete=models.CASCADE, related_name="orders")
    delivery_fee = models.PositiveIntegerField(default=0)  # naira, copied from the stall when the order was placed
    status = models.CharField(max_length=20, default="awaiting_payment")
    reference = models.CharField(max_length=40, blank=True, default="")  # only used by orders made before Checkout existed
    paid = models.BooleanField(default=False)
    refunded = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    qty = models.PositiveIntegerField(default=1)
    price = models.PositiveIntegerField(default=0)  # naira per item, copied when the order was placed


class OrderEvent(models.Model):
    """One step in an order's journey; powers the tracker."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=20)
    created = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=300, blank=True, default="")
    link = models.CharField(max_length=120, blank=True, default="")
    read = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)


class EmailCode(models.Model):
    """A 6-digit code emailed to confirm an address. Only a hash of the code is stored."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    email = models.EmailField()
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)


class ResetCode(models.Model):
    """A 6-digit code emailed to someone who forgot their password. Only a hash of the code is stored."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)


class SupportTicket(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tickets")
    subject = models.CharField(max_length=120)
    status = models.CharField(max_length=10, default="open")  # open / closed
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)


class SupportMessage(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="messages")
    from_staff = models.BooleanField(default=False)
    text = models.TextField()
    created = models.DateTimeField(auto_now_add=True)