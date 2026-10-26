from django.core.management.base import BaseCommand

from core.models import Campus, MenuItem, Stall, User

DEMO_CAMPUS = "Demo University"
DEMO = {
    "demo_mama": ("Mama Nkechi's Kitchen", 300, [
        ("Jollof Rice & Chicken", 1800, "hearty,protein,spicy"),
        ("Egusi Soup & Pounded Yam", 2200, "hearty,soup,swallow,protein"),
        ("Moi Moi", 600, "protein,light,breakfast"),
        ("Fried Plantain", 500, "sweet,fried,snack"),
        ("Fish Pepper Soup", 1500, "soup,protein,spicy,light")]),
    "demo_bukka": ("Campus Bukka", 200, [
        ("Amala & Ewedu", 1500, "hearty,swallow,soup,veggie"),
        ("Ofada Rice & Stew", 2000, "hearty,spicy"),
        ("Akara & Pap", 700, "breakfast,fried,light"),
        ("Vegetable Soup & Eba", 1800, "veggie,soup,swallow,hearty"),
        ("Boiled Yam & Egg Sauce", 1200, "breakfast,hearty,protein")]),
    "demo_suya": ("Suya Spot", 0, [
        ("Beef Suya (Large)", 1500, "protein,spicy,snack"),
        ("Chicken Suya", 1800, "protein,spicy"),
        ("Roasted Corn", 400, "snack,light,veggie"),
        ("Chin Chin", 300, "sweet,fried,snack"),
        ("Zobo (Cold)", 300, "light,sweet")]),
}


class Command(BaseCommand):
    help = "Create demo stalls, dishes and logins. Run with --delete to remove them before going live."

    def add_arguments(self, parser):
        parser.add_argument("--delete", action="store_true")

    def handle(self, *args, **opts):
        from django.conf import settings
        if not settings.DEBUG:
            self.stderr.write("Refusing to create demo accounts (known password) while DEBUG is off.")
            return
        names = list(DEMO) + ["demo_student"]
        if opts["delete"]:
            User.objects.filter(username__in=names).delete()
            Campus.objects.filter(name=DEMO_CAMPUS, stalls__isnull=True).delete()  # only if no real stall is on it
            self.stdout.write("Deleted the demo accounts, their stalls and their orders.")
            return
        campus, _ = Campus.objects.get_or_create(name=DEMO_CAMPUS)
        for username, (stall_name, fee, items) in DEMO.items():
            u, _ = User.objects.get_or_create(username=username, defaults={"role": "stall_admin"})
            u.set_password("demo1234")
            u.save()
            s, _ = Stall.objects.get_or_create(owner=u, defaults={"name": stall_name, "approved": True})
            s.campus, s.delivery_fee = campus, fee
            s.save()
            if not s.items.exists():
                MenuItem.objects.bulk_create([MenuItem(stall=s, name=n, price=p, tags=t) for n, p, t in items])
        u, _ = User.objects.get_or_create(username="demo_student", defaults={"role": "student"})
        u.set_password("demo1234")
        u.save()
        self.stdout.write(f"Seeded on the campus '{DEMO_CAMPUS}'. Logins: demo_mama, demo_bukka, demo_suya (stall admins) and demo_student. Password: demo1234")