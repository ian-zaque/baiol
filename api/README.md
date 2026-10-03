# Baiol API

NestJS API in front of Postgres. The mobile app talks to this API for accounts, lists, items, share links, and live updates. Supabase is the database adapter.

## Setup

1. Create a Supabase project.
2. Run [`../supabase/schema.sql`](../supabase/schema.sql) in the SQL editor. On a database created from an older copy, also run any migration you have not applied yet, through [`../supabase/2026_10_03_000009_users_and_ids.sql`](../supabase/2026_10_03_000009_users_and_ids.sql).
3. Copy `.env.example` to `.env` and fill every required variable. The process exits when one is missing.

```bash
npm install
npm run start:dev
```

`GET http://localhost:3000/` returns `Hello World!` when the process is up. `GET http://localhost:3000/health` returns `{ ok: true }`.

## Auth

`POST /auth/register`, `POST /auth/login`, and `POST /auth/refresh` return `access_token` and `refresh_token`. Send `Authorization: Bearer <access token>` on REST and Socket.io (`auth.token`) for owned lists. `POST /auth/logout` revokes the refresh token.

Share-link guests use `GET /shared/:token` (no JWT) and Socket.io `auth.shareToken` + `auth.guestId`.

## Main routes

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /me/sync` — load the signed-in profile
- `GET|PATCH /me`
- `GET|POST /lists`
- `GET|PATCH|DELETE /lists/:id` (delete is owner-only, soft delete)
- `GET /lists/:id/share` — copyable app + web links
- `POST /lists/:id/share/rotate` — owner-only, invalidates the old link
- `POST|PATCH|DELETE /lists/:id/items/:itemId`
- `GET /grocery-types`
- `GET /lists/:id/members`
- `GET /shared/:token` — public list JSON (HTML if the client asks for it)
- `PATCH /shared/:token`
- `POST|PATCH|DELETE /shared/:token/items/:itemId`
