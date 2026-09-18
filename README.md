# Tape

A shared accountability app for a small crew — check in daily with what you
trained, log body measurements and progress photos, react and reply to each
other, and see who has and hasn't shown up today. React + Appwrite, all on free
tiers.

## Stack

- **Frontend:** React + Vite, deployed on Netlify. Installable PWA.
- **Backend:** Appwrite Cloud — TablesDB (`users`, `entries`, `checkins`,
  `reactions`, `comments`) and one storage bucket (`photos`). Free tier.
  Everything is open to the "Any" role; there is no server-side code.
- **Realtime:** one `client.subscribe` on the Crew feed, so reactions and
  replies land without a refresh.
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

4. **Seed some activity** (optional) — a week of check-ins with reactions and
   replies, so the feed isn't empty while you work on it:
   ```bash
   node scripts/seed-checkins.mjs
   ```

5. **Run**
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
- **entries** — a measurement. `userId` (a user's `$id`), `date`
  (`YYYY-MM-DD`), `note?`, `photoUrl?`, and optional doubles `weight`, `chest`,
  `waist`, `hips`, `arm`, `thigh`
- **checkins** — a training session. `userId`, `date`, `activity` (a key from
  `src/lib/activities.js`), `note?`, `photoUrl?`, `photoId?`
- **reactions** — `targetKey`, `targetType`, `targetId`, `userId`, `emoji`
- **comments** — the same four target columns plus `body`

Check-ins are a separate table rather than a row type on `entries`, so a
session with no numbers can never reach the chart's delta maths.

There are no joins in Appwrite, so the crew feed fetches entries, check-ins and
users separately and stitches authors together client-side (`src/lib/db.js`).

### `targetKey`, and why it exists

Reactions and comments hang off both kinds of post, but Appwrite has no
cross-column `OR` — `(targetType = 'entry' AND targetId IN [...]) OR
(targetType = 'checkin' AND targetId IN [...])` is not expressible. A single
`targetKey` column holding `` `${targetType}:${targetId}` `` collapses that to
one indexed equality against an array, so a whole feed page costs **five
requests regardless of how many posts are on it** — two for the posts, one for
users, one for every reaction, one for every comment. (`$id` is only unique per
table, so the type prefix is load-bearing, not decoration.)

A `uniq_reaction` unique index on `(targetKey, userId, emoji)` makes a
double-tap a 409 rather than a duplicate; `toggleReaction` treats that as "it's
already on" and reconciles.

`pinHash` is capped at 100 characters, which is why the stored format
(`sha256$<16-hex-salt>$<64-hex-digest>`, 88 chars) uses an 8-byte salt.

## Photo handling

Any image the phone offers is accepted (JPEG/PNG/HEIC/HEIF). Before upload the
app resizes the longest edge to ~900px and re-encodes to JPEG ~60% on a canvas,
turning a 4–5MB photo into ~100–300KB. If decoding fails (e.g. HEIC in a
non-Safari browser), it uploads the original untouched — an upload is never
blocked. The resulting file URL is saved to the entry's `photoUrl`.

## Screens

- **Crew** — the crew row (who's in today, who's the gap) above a merged feed of
  check-ins and measurements, newest first. Every post takes reactions and
  replies. Updates live. Tapping any avatar opens that person's profile.
- **Today** — the daily check-in: tap an activity, optionally add a note and a
  photo. One tap is a complete check-in.
- **Log** — date (defaults to today), optional measurements (numeric keyboard on
  mobile), one photo, a note. After saving, shows the delta vs. your last entry.
- **You** — your own profile. The same screen as anyone else's (`/me` and
  `/crew/:userId` both render `Profile`), plus an account section that only
  renders for yourself.

A profile carries a 14-day consistency strip, a photo grid where any two shots
can be selected and compared side by side with the measurement change between
them, the measurement chart, and recent posts. The chart is measurements only;
check-ins never enter it.

Still out of scope: streaks, badges, goal lines, push notifications,
leaderboards, body-diagram input, unit conversion (kg/cm are hardcoded).

## Icons

See `public/icons/README.md` to add the PWA home-screen icons.
