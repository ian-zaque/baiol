# Baiol API

NestJS API in front of Supabase. The mobile app talks only to this API for lists, items, invites, and live updates.

## Setup

1. Create a Supabase project.
2. Run [`../supabase/schema.sql`](../supabase/schema.sql) in the SQL editor.
3. In Authentication settings, enable email/password. For local testing you can disable **Confirm email**.
4. Copy `.env.example` to `.env` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API)
5. Optional: set `RESEND_API_KEY` for invite emails. Without it, invite links are printed in the API logs.

```bash
npm install
npm run start:dev
```

Health check: `GET http://localhost:3000/health`

## Auth

Send `Authorization: Bearer <supabase access token>` on REST and Socket.io (`auth.token`).

## Main routes

- `POST /me/sync` — upsert profile and auto-accept pending email invites
- `GET|PATCH /me`
- `GET|POST /lists`
- `GET|PATCH|DELETE /lists/:id` (delete is owner-only, soft delete)
- `POST|PATCH|DELETE /lists/:id/items/:itemId`
- `GET /lists/:id/members`
- `GET|POST /lists/:id/invites`
- `DELETE /lists/:id/invites/:inviteId`
- `POST /invites/:token/accept`
- `GET /invites/:token` — HTML fallback for email links

Socket.io: `join_list` / `leave_list`, events `presence`, `item.created`, `item.updated`, `item.deleted`, `list.updated`, `members.changed`.
