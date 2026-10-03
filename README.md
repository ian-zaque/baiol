# Baiol

Baiol is a grocery-list app. You create a list, add items with a price and a grocery type, and share a link. Someone with the link can open and edit the list without an account. People on the same list see item changes and who else is there.

The repo has three parts:

- `mobile` — Expo app (iOS, Android, and web)
- `api` — NestJS API for lists, items, share links, and live updates
- `supabase` — SQL for the database (auth, lists, items, grocery types)

Accounts live in Supabase Auth. The API uses the Supabase service role and is the only thing that reads and writes app data.

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
4. In Supabase, under Authentication, enable email and password. For local testing, turn off **Confirm email** so a new account can sign in immediately.
5. Copy the env examples and fill them in:

```bash
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
```

In `api/.env`:

- `SUPABASE_URL` — Project Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` secret
- `API_PUBLIC_URL` — public address of this API (local default `http://localhost:3000`)
- `WEB_APP_URL` — Expo web origin (local default `http://localhost:8081`)

In `mobile/.env`:

- `EXPO_PUBLIC_SUPABASE_URL` — same project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → `anon` public key
- `EXPO_PUBLIC_API_URL` — API address the phone or browser can reach

On a physical phone, `EXPO_PUBLIC_API_URL` must be your computer’s LAN address, for example `http://192.168.0.10:3000`, not `localhost`. The Android emulator uses `http://10.0.2.2:3000`.

6. Install dependencies in both apps:

```bash
npm install --prefix api
npm install --prefix mobile
```

## Run

Start the API and the Expo app in two terminals.

```bash
npm run start:dev --prefix api
```

The API listens on port 3000. `GET http://localhost:3000/health` should return ok.

```bash
npm run web --prefix mobile
```

That opens the web app at `http://localhost:8081`. Other targets:

```bash
npm start --prefix mobile
npm run android --prefix mobile
npm run ios --prefix mobile
```

`npm start` prints a QR code for the Expo Go or development client. Sign up in the app, create a list, and use Share to copy a link.

More API routes are listed in [`api/README.md`](api/README.md).
