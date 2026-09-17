# Tape

A shared fitness tracker for a small crew — log body measurements and progress
photos, watch each measurement move over time, and see everyone's activity in
one feed. React + Appwrite, all on free tiers.

## Stack

- **Frontend:** React + Vite, deployed on Netlify. Installable PWA.
- **Backend:** Appwrite Cloud — TablesDB (`users`, `entries`) and one storage
  bucket (`photos`). Free tier. Pre-built; the app uses it as-is.
- **Charts:** Recharts.

## How "auth" works

There is no Appwrite Auth. On first visit you pick your name from the crew list
and enter a 4-digit PIN, which is checked in the browser against the `pinHash`
on your row. Your `$id` is then kept in `localStorage`, so later visits skip
straight in (use "switch" on the Log screen to change user).

### Security, stated plainly

This is a soft lock, not real security, and it's worth being clear about why:

- The tables and bucket are open to the **"Any"** role, so anyone who knows the
  project ID can read and write everything — no PIN required.
- `pinHash` is therefore public, and a 4-digit PIN is only 10,000
  possibilities. A salted SHA-256 hash of one can be brute-forced offline in
  well under a second.

So the PIN keeps crew members out of each other's logs. It does **not** protect
the data from anyone outside the group. Don't share the site URL publicly, and
don't log anything you'd mind a stranger reading. Moving to real Appwrite Auth
with per-row permissions is the fix if that ever matters.

## Local setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Configure env** — copy `.env.example` to `.env`. It already carries the
   real project values; none of them are secrets.
   ```
   VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=...
   VITE_APPWRITE_DATABASE_ID=...
   VITE_APPWRITE_PHOTOS_BUCKET_ID=...
   ```

3. **Seed the crew** — the `users` table starts empty, and the app can't be
   logged into until it has rows. Each argument is `name:#rrggbb:pin`:
   ```bash
   node scripts/seed-users.mjs "Miguel:#4f8cff:1234" "Ana:#ff6b6b:5678"
   ```
   Re-running with an existing name updates that person's colour and PIN
   instead of creating a duplicate.

4. **Run**
   ```bash
   npm run dev
   ```

## Deploy to Netlify

- Connect the repo (or drag-and-drop `dist/`). Build settings come from
  `netlify.toml` (`npm run build` → `dist`, with SPA redirect).
- Add the four `VITE_APPWRITE_*` variables under Site settings → Environment
  variables. They're read at build time, so redeploy after changing one.
- In the Appwrite console, add your Netlify domain as a **Web platform** under
  Project → Platforms, or the browser will be blocked by CORS.

## Data shape

Rows carry Appwrite's own metadata — the primary key is `$id`, not `id`, and
creation time is `$createdAt`.

- **users** — `name`, `color` (hex), `pinHash`
- **entries** — `userId` (a user's `$id`), `date` (`YYYY-MM-DD`), `note?`,
  `photoUrl?`, and optional doubles `weight`, `chest`, `waist`, `hips`, `arm`,
  `thigh`

There are no joins in Appwrite, so the crew feed fetches entries and users
separately and stitches authors together client-side (`src/lib/db.js`).

`pinHash` is capped at 100 characters, which is why the stored format
(`sha256$<16-hex-salt>$<64-hex-digest>`, 88 chars) uses an 8-byte salt.

## Photo handling

Any image the phone offers is accepted (JPEG/PNG/HEIC/HEIF). Before upload the
app resizes the longest edge to ~900px and re-encodes to JPEG ~60% on a canvas,
turning a 4–5MB photo into ~100–300KB. If decoding fails (e.g. HEIC in a
non-Safari browser), it uploads the original untouched — an upload is never
blocked. The resulting file URL is saved to the entry's `photoUrl`.

## Screens (v1)

- **Crew** — everyone's entries, newest first, with thumbnail, name, date.
- **Log** — date (defaults to today), optional measurements (numeric keyboard on
  mobile), one photo, a note. After saving, shows the delta vs. your last entry.
- **The Tape** — a per-measurement line chart of your own history, switchable.

Out of scope for v1: streaks, badges, goal lines, reminders, leaderboards,
body-diagram input, unit conversion (kg/cm are hardcoded).

## Icons

See `public/icons/README.md` to add the PWA home-screen icons.
