# Garlandale FC — Club Management App

A single-user (Chairman-only, no login) club management app: player roster,
age groups, subscription tracking, compliance status, matchday squad
selection with a printable official team sheet, kit/stock tracking, and
WhatsApp/SMS message triggers — backed by a free Supabase (Postgres)
database instead of local in-app storage.

## 1. Create your free Supabase project

1. Go to https://supabase.com and sign up (free tier).
2. Click **New project**. Pick any name/region, set a database password
   (you won't need it day-to-day — just keep it somewhere safe).
3. Wait ~2 minutes for the project to spin up.

## 2. Create the tables

1. In your Supabase project, open **SQL Editor** (left sidebar).
2. Click **New query**, paste in the entire contents of `schema.sql` from
   this folder, and click **Run**.
3. This creates `players`, `payments`, `matches`, `match_squad`,
   `inventory_items`, and `issued_items` tables, sets up permissive access
   policies (since there's no login screen), and adds a few sample players
   and stock items so you can see the app working immediately. Delete the
   samples from the Squad and Kit tabs once you're ready to add real data.

## 3. Get your API keys

1. In Supabase, go to **Project Settings -> API**.
2. Copy the **Project URL** and the **anon / public** key (NOT the
   `service_role` key — that one must never be used in browser code).

## 4. Configure the app

1. In this project folder, copy `.env.example` to a new file called `.env`.
2. Fill in the two values from step 3:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
3. `.env` is only ever read locally / at build time — it won't be committed
   if you use the included `.gitignore` pattern (add `.env` to it if you
   set up git).

## 5. Install and run

```bash
npm install
npm run dev
```

This opens the app at `http://localhost:5173`. Any changes you make (adding
players, logging payments, editing details) now save straight to your
Supabase database, not just to your browser.

## 6. Put it online (optional, still free)

Once it works locally, you can deploy it for free on **Vercel** or
**Netlify**:
1. Push this folder to a GitHub repo.
2. Import the repo on vercel.com or netlify.com.
3. Add the same two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in the deployment platform's settings.
4. Deploy — you'll get a permanent URL you can bookmark and use from any
   device, no install required.

## What's in this version

- **Squad & Subscriptions** — same as before: roster, age groups, payment
  ledgers, and the green/amber/red compliance indicator.
- **Federation reg. no** — each player now has a `reg_no` field for the
  number issued by the football association once they're registered. It's
  optional until then (shown as "Pending federation number"), but the
  database won't allow two players to share the same number once one is
  assigned.
- **Matchday** — create a fixture, build a Starting XI + up to 9 subs from
  the relevant age group, and click "Print team sheet" to generate a
  print-ready copy of the official league team sheet (Cape Town Tygerberg
  LFA format), pre-filled with your players, jersey numbers, and reg
  numbers. The referee/score/signature sections are left blank for matchday,
  as they always are on the paper original.
- **Kit & Stock** — track inventory (jerseys, tracksuits, etc.) and what's
  currently issued to which player, with stock levels adjusting
  automatically as you issue and return items.
- **Messages** — WhatsApp/SMS link generation, unchanged from before.

## A note on the team sheet

The printable sheet opens in a new browser tab/window and calls the browser's
own print dialog — no PDF library involved. If your browser blocks the popup,
just allow pop-ups for this site once. The GS/YC/RC/INJ columns, signatures,
and substitution boxes are intentionally left blank, since those are filled
in by hand on the day.

## A note on security

There's no login screen by design — this is built for a single trusted user
(the Chairman) rather than multiple staff accounts. That means anyone who
has your app's URL *and* both env values could read/write the data — there's
no per-user lock. Keep the `.env` values and (if deployed) the app URL
private, the same way you'd treat a shared spreadsheet link. If down the
line you want specific staff to log in with their own accounts and
permissions, Supabase supports that (Auth + refined RLS policies) — just
let me know and that can be layered on top of this without starting over.
