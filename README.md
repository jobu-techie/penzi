# Penzi

Penzi is an SMS-based dating platform for Kenya, with a web app and a
native mobile app built on top of the same backend. Registration, match
search, and consent all originated as SMS commands (`start#...`,
`match#...`, `YES`/`NO`) processed by the backend; the web and mobile
clients extend that same flow with a full account/profile/chat
experience.

Live at [52.48.121.185:5173](http://52.48.121.185:5173).

## Structure

This repo hosts all three parts of the product:

- **[`backend/`](backend)** — Flask + MySQL API. SMS command handling,
  REST endpoints, JWT auth, OTP login, chat, subscriptions/M-Pesa
  payments, and the admin API.
- **[`frontend/`](frontend)** — React + Vite web app. Registration,
  login, match search, chat, subscriptions, and the admin panel.
- **[`mobile/`](mobile)** — React Native app (Android/iOS). Mirrors the
  web app's core user-facing flows.

Each has its own `README.md` with stack-specific setup details.

## Running locally

The backend and frontend run together via Docker Compose from the repo
root:

```bash
docker compose --env-file backend/.env up -d --build
```

This builds `backend/` and `frontend/` as separate services alongside a
MySQL container. Each needs its own `.env` (see `backend/.env.example`
and `frontend/.env.example`) before building — Compose reads
`backend/.env` at container start, and Vite bakes `frontend/.env`
values into the production bundle at *build* time, so both must exist
before `docker compose build` runs. The `--env-file backend/.env` flag
is needed because Compose's own `${VAR}` substitution (used by the `db`
service) only auto-discovers a `.env` sitting next to `docker-compose.yml`
itself, which isn't where ours lives.

The mobile app (`mobile/`) is built and run independently through
Android Studio / Xcode / the React Native CLI — see `mobile/README.md`.

## Deployment

Deployed via the root `Jenkinsfile` to a single EC2 instance, or
manually via `git pull` + `docker compose up -d --build` from the repo
root followed by the usual `flask db migrate` / `flask db upgrade`
inside the `api` container for any schema changes.
