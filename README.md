# Tape

A shared fitness tracker for a small crew — log body measurements and progress
photos, watch each measurement move over time, and see everyone's activity in
one feed. React + Supabase, all on free tiers.

## Stack

- **Frontend:** React + Vite, deployed on Netlify. Installable PWA.
- **Backend:** Supabase — Postgres (data), Storage (photos), one Edge Function
  (server-side PIN check). Free tier throughout.
- **Charts:** Recharts.

## How auth works

No signup. On first visit you pick your name from the preset roster and enter a
4-digit PIN. The PIN is verified by the `verify-pin` Edge Function against a
bcrypt hash — the hash never reaches the browser. After that, your identity is
remembered in `localStorage`, so no re-entry on later visits (use "switch" on the
Log screen to change user).

Data access is deliberately open (anon key + permissive RLS) for this trusted
family group; don't share the site URL publicly.

## Local setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create a Supabase project** (free tier), then in the SQL editor run, in order:
   - `supabase/schema.sql` — tables, RLS, the PIN-check function, storage bucket.
   - `supabase/seed.sql` — the preset crew. **Edit names / colors / PINs first.**

3. **Deploy the Edge Function** (requires the Supabase CLI, `supabase login`, and
   `supabase link` to your project):
   ```bash
   supabase functions deploy verify-pin --no-verify-jwt
   ```

4. **Configure env** — copy `.env.example` to `.env` and fill in from
   Supabase → Settings → API:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

5. **Run**
   ```bash
   npm run dev
   ```

## Deploy to Netlify

- Connect the repo (or drag-and-drop `dist/`). Build settings come from
  `netlify.toml` (`npm run build` → `dist`, with SPA redirect).
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
  in the Netlify site settings.

## Photo handling

Any image the phone offers is accepted (JPEG/PNG/HEIC). Before upload the app
resizes the longest edge to ~900px and re-encodes to JPEG ~60% on a canvas,
turning a 4–5MB photo into ~100–300KB. If decoding fails (e.g. HEIC in a
non-Safari browser), it uploads the original untouched — an upload is never
blocked.

## Screens (v1)

- **Crew** — everyone's entries, newest first, with thumbnail, name, date.
- **Log** — date (defaults to today), optional measurements (numeric keyboard on
  mobile), one photo, a note. After saving, shows the delta vs. your last entry.
- **The Tape** — a per-measurement line chart of your own history, switchable.

## Icons

See `public/icons/README.md` to add the PWA home-screen icons.
