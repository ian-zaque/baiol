# Baiol API

NestJS API in front of Supabase. The mobile app talks to this API for lists, items, share links, and live updates.

## Setup

1. Create a Supabase project.
2. Run [`../supabase/schema.sql`](../supabase/schema.sql) in the SQL editor.
3. In Authentication settings, enable email/password. For local testing you can disable **Confirm email**.
4. Copy `.env.example` to `.env` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API)

```bash
npm install
npm run start:dev
```

`GET http://localhost:3000/` returns `{ ok: true, service: "baiol-api" }` when the process is up. `GET http://localhost:3000/health` returns `{ ok: true }`.

## Auth

Send `Authorization: Bearer <supabase access token>` on REST and Socket.io (`auth.token`) for owned lists.

Share-link guests use `GET /shared/:token` (no JWT) and Socket.io `auth.shareToken` + `auth.guestId`.

## Main routes

- `POST /me/sync` — upsert profile
- `GET|PATCH /me`
- `GET|POST /lists`
- `GET|PATCH|DELETE /lists/:id` (delete is owner-only, soft delete)
- `GET /lists/:id/share` — copyable app + web links
- `POST /lists/:id/share/rotate` — owner-only, invalidates the old link
- `POST|PATCH|DELETE /lists/:id/items/:itemId`
- `GET /lists/:id/members`
- `GET /shared/:token` — public list JSON (HTML if the client asks for it)
- `PATCH /shared/:token`
- `POST|PATCH|DELETE /shared/:token/items/:itemId`

Socket.io: `join_list` / `leave_list`, events `presence`, `item.created`, `item.updated`, `item.deleted`, `list.updated`, `members.changed`.
