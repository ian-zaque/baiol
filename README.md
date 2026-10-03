# Baiol

Baiol is a grocery-list app. You create a list, add items with a price and a grocery type, and share a link. Someone with the link can open and edit the list without an account. People on the same list see item changes and who else is there.

The repo has three parts:

- `mobile` — Expo app (iOS, Android, and web)
- `api` — NestJS API for lists, items, share links, and live updates
- `supabase` — SQL for Postgres (profiles, sessions, lists, items, grocery types)

Accounts are created and checked by the API. Postgres stores the data. The API reaches Postgres through a Supabase adapter and the service role key.

## Requirements

- Node.js 20 or newer
- npm
- A [Supabase](https://supabase.com) project

## Install

1. Create a Supabase project.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). That file is the full schema for a new database.
3. If the database was created from an older copy of that file, run any migration you have not applied yet. Migrations are named `YYYY_MM_DD_00000N_name.sql`, for example `2026_09_29_000002_create_partners_social_media_links_logs_table.sql`. The number is six digits and starts at `000001` for that date. Run them by date, then by that number:
   - [`supabase/2026_10_02_000001_share_token.sql`](supabase/2026_10_02_000001_share_token.sql)
   - [`supabase/2026_10_02_000002_currency.sql`](supabase/2026_10_02_000002_currency.sql)
   - [`supabase/2026_10_02_000003_grocery_types.sql`](supabase/2026_10_02_000003_grocery_types.sql)
   - [`supabase/2026_10_02_000004_integrity.sql`](supabase/2026_10_02_000004_integrity.sql)
   - [`supabase/2026_10_03_000001_item_checked.sql`](supabase/2026_10_03_000001_item_checked.sql)
   - [`supabase/2026_10_03_000002_profiles_log.sql`](supabase/2026_10_03_000002_profiles_log.sql)
   - [`supabase/2026_10_03_000003_lists_log.sql`](supabase/2026_10_03_000003_lists_log.sql)
   - [`supabase/2026_10_03_000004_grocery_types_log.sql`](supabase/2026_10_03_000004_grocery_types_log.sql)
   - [`supabase/2026_10_03_000005_items_log.sql`](supabase/2026_10_03_000005_items_log.sql)
   - [`supabase/2026_10_03_000006_list_members_log.sql`](supabase/2026_10_03_000006_list_members_log.sql)
   - [`supabase/2026_10_03_000007_list_invites_log.sql`](supabase/2026_10_03_000007_list_invites_log.sql)
   - [`supabase/2026_10_03_000008_api_auth.sql`](supabase/2026_10_03_000008_api_auth.sql)
   - [`supabase/2026_10_03_000009_users_and_ids.sql`](supabase/2026_10_03_000009_users_and_ids.sql)
4. Copy the env examples and fill them in:

```bash
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
```

In `api/.env`:

- `PORT` — API listen port
- `SUPABASE_URL` — Project Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` secret
- `APP_SCHEME` — app URL scheme, matching `scheme` in `mobile/app.json`
- `API_PUBLIC_URL` — public address of this API
- `WEB_APP_URL` — Expo web origin
- `AUTH_JWT_SECRET` — long random string used to sign access tokens
- `AUTH_ACCESS_TTL_SECONDS` — access token lifetime in seconds
- `AUTH_REFRESH_TTL_SECONDS` — refresh token lifetime in seconds
- `RESEND_API_KEY` and `MAIL_FROM` — optional; `MAIL_FROM` is required when the API key is set

In `mobile/.env`:

- `EXPO_PUBLIC_API_URL` — API address the phone or browser can reach

On a physical phone, `EXPO_PUBLIC_API_URL` must be your computer’s LAN address, for example `http://192.168.0.10:3000`, not `localhost`. The Android emulator uses `http://10.0.2.2:3000`.

5. Install dependencies in both apps:

```bash
npm install --prefix api
npm install --prefix mobile
```

## Run

Open two terminals in this repo folder (the folder that contains `api` and `mobile`). Leave both running.

Terminal 1, the API:

```bash
npm run start:dev --prefix api
```

Wait until it says it is listening. It uses port 3000. Open `http://localhost:3000/health` in the browser. You should see `{ "ok": true }`.

Terminal 2, the app in the browser:

```bash
npm run web --prefix mobile
```

Expo opens `http://localhost:8081`. Sign up, create a list, and use Share to copy a link.

To use a phone or emulator instead of the browser, run one of these in terminal 2:

```bash
npm start --prefix mobile
npm run android --prefix mobile
npm run ios --prefix mobile
```

`npm start --prefix mobile` prints a QR code for Expo Go. On a physical phone, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to this computer’s LAN address before you start Expo, for example `http://192.168.0.10:3000`. The Android emulator uses `http://10.0.2.2:3000`.

More API routes are listed in [`api/README.md`](api/README.md).

## Test

Install dependencies once:

```bash
npm install --prefix api
npm install --prefix mobile
```

Run the automated tests:

```bash
npm test --prefix api
npm run test:e2e --prefix api
npm test --prefix mobile
```

To test the running app, apply the SQL migrations in Install, start the API, and open the web app (`npm run web --prefix mobile`). `GET http://localhost:3000/health` should return `{ "ok": true }`.

1. Sign up and sign in. Change the display name.
2. Create a list, rename it, then delete it.
3. Add an item, mark it bought, then delete it.
4. Open the share link in a private window and edit an item without signing in.
5. On the login screen, use the eye button to show and hide the password. On a list, use the checkbox to mark an item bought.
