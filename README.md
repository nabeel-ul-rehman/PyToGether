# PayTogether

A web application for tracking and splitting shared trip expenses. Create a
tour, share its join code with the group, log expenses as you go, and let
PayTogether work out who paid what and who owes whom.

Final Year Project — BS Information Technology, Govt. Graduate College,
Civil Lines, Sheikhupura (University of the Punjab).

## Features

- Email/password authentication with JWT access & refresh tokens
- Create a tour and get an auto-generated 6-character join code
- Join an existing tour with that code
- Add, edit (your own), and delete expenses on a tour
- Automatic total & per-member share calculation, with a live balance report
- Dashboard with cross-tour stats and a recent-activity feed
- Tour image upload, search/sort/paginate on the tours list
- Only the tour creator can edit/delete the tour; only the member who logged
  an expense can edit or delete it

## Tech stack

Django 6 + Django REST Framework + SimpleJWT for the backend, SQLite for
local development, and server-rendered templates styled with Tailwind CSS
(via CDN) and vanilla JavaScript on the frontend — no build step required.

## Getting started

```bash
python -m venv env
# Windows: env\Scripts\activate
source env/bin/activate

pip install -r requirements.txt

# Copy .env.example to .env and set a local development SECRET_KEY.

python manage.py migrate
python manage.py createsuperuser   # optional, for /admin/
python manage.py runserver
```

Visit `http://127.0.0.1:8000/`.

## Deploying to Railway from GitHub

This repository includes a Railpack configuration. Railway installs
`requirements.txt`, collects static files during the build, runs database
migrations when the web service starts, and launches Django with Gunicorn.

1. Push this project to a GitHub repository.
2. In Railway, create a project and choose **Deploy from GitHub repo**.
3. Add a PostgreSQL service to the project.
4. In the Django service's Variables, add:

   - `SECRET_KEY`: a long, random secret. Generate one locally with
     `python -c "import secrets; print(secrets.token_urlsafe(50))"`.
   - `DEBUG`: `False`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (adjust `Postgres` if your
     database service has a different name).
   - `MEDIA_ROOT`: `/app/media`

   `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` are populated automatically
   from Railway's `RAILWAY_PUBLIC_DOMAIN`. Add your custom domain's host to
   `ALLOWED_HOSTS` and its `https://` origin to `CSRF_TRUSTED_ORIGINS` if you
   use a custom domain.

5. Add a Railway volume to the Django service, mounted at `/app/media`, so
   uploaded tour images persist across deploys and restarts. Railway's
   container filesystem is otherwise temporary. The app serves these uploaded
   files from this persistent directory.
6. Generate a Railway public domain for the Django service, then set its
   health check path to `/health/` in the service's Deploy settings.

Do not commit `.env`, database files, or uploaded media. The production
database should be Railway PostgreSQL; the local SQLite database is only a
development fallback.

## Project layout

```
apps/
  accounts/   # custom User model, JWT auth, profile
  tours/      # Tour + TourMember models, join-by-code flow
  expenses/   # Expense model & CRUD, scoped to a tour's members
  reports/    # computed per-tour expense summary & balances
  core/       # landing page + dashboard stats API
templates/    # server-rendered pages (Tailwind CDN, no build step)
static/js/    # page-specific JS + shared app-shell.js (auth/token helpers)
```

## Notes for graders

- The database ships empty; register a new account to try the full flow, or
  create two accounts to test the join-tour / shared-expense features.
- `python manage.py createsuperuser` gives access to `/admin/` where every
  model (users, tours, members, expenses, reports) can be inspected directly.
