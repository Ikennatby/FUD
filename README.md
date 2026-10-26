# FÜD: campus food ordering

Next.js (React) frontend + Django backend, with Paystack payments.

## First-time setup (Windows)

Backend, in `backend/`:

    py -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    copy .env.example .env        (then open .env and paste your Paystack TEST secret key)
    py manage.py makemigrations core   (creates the migration for any new fields)
    py manage.py migrate
    py manage.py createsuperuser  (this account approves stalls)
    py manage.py seed_demo        (optional demo stalls; remove later with: py manage.py seed_demo --delete)

Frontend, in `frontend/`:

    npm install

## Run it (two terminals)

    cd backend  ->  venv\Scripts\activate  ->  py manage.py runserver
    cd frontend ->  npm run dev

Open http://localhost:3000

## Paystack

- Put `PAYSTACK_SECRET_KEY=sk_test_...` in `backend/.env`, then restart the backend.
- With no key, and only while DEBUG is on, orders are marked paid instantly and no money moves.
- Stalls add their bank account on **My stall**. Paystack creates a subaccount, and student payments are split to it.
- `PLATFORM_FEE_PERCENT` is your cut of each order. `PAYSTACK_BEARER` says who pays Paystack's fee ("subaccount" = the stall, "account" = you).
- Webhook (optional but recommended once public): `https://YOUR-BACKEND/api/paystack/webhook/`

## Before going live

1. `py manage.py seed_demo --delete`
2. Set `DJANGO_DEBUG=0`, a long random `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `FRONTEND_URL` (in the environment, not in git).
3. Use your live Paystack key and set `NEXT_PUBLIC_API_URL` to your real API address.
4. Move off SQLite (e.g. PostgreSQL) and serve Django with gunicorn or similar.

## Accounts, profile and email

- Sign-up asks for an email and sends a 6-digit code. Enter it on the page that opens after sign-up, or later in **Profile → Account**.
- **Local testing:** with no `EMAIL_HOST` set, emails are printed in the backend terminal, and the code also shows on the page.
- **Real emails:** put the `EMAIL_*` values from `.env.example` in `backend/.env` (Gmail needs an "app password"; Brevo or Resend also work), then restart.
- Order updates (paid, accepted, preparing, ready, completed, cancelled) arrive in the app, and by email once the address is verified.
- **Profile** has order history, account (email, phone, password), privacy and consent, notification choices, help chat, delete account and log out.
- **Admin page** (log in as your superuser): approve stalls, send updates to everyone, students or stall owners, and reply to support messages.
- Deleting an account removes the person's details but keeps their paid orders without a name, so stalls keep their sales records.
