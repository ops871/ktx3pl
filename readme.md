# KTX 3PL Warehouse Tracker

A Progressive Web App (PWA) for tracking manual inbounds, outbounds, and
paperwork for out-of-scope warehouse projects. It works as a website **and**
installs to a desktop or phone home screen, works offline (app shell), and
stores all data in a shared [Supabase](https://supabase.com) backend so every
member of the team sees the same records from any device.

## Features

- **Multiple user accounts** — email/password login and signup (Supabase Auth).
  Every record is stamped with the user who created it.
- **Projects** — group inbound/outbound activity by warehouse project.
- **Inbound records** — reference no., carrier, description, quantity, status
  (pending / received / discrepancy).
- **Outbound records** — same fields plus destination, status
  (pending / shipped / cancelled).
- **Paperwork attachments** — upload PDFs/photos (BOLs, packing slips, signed
  paperwork) to a specific inbound or outbound entry. Files live in a **private**
  Supabase Storage bucket and are served via short-lived signed URLs.
- **Offline-capable PWA** — installable, with the static app shell cached by a
  service worker. (Live data still requires a connection.)

## Tech stack

No build step. Plain HTML, CSS, and JavaScript served as static files. The
Supabase JS client is loaded from a CDN. The backend is a hosted Supabase
project (Postgres + Auth + Storage).

```
warehouse-tracker/
├── index.html            # App shell (auth view + app view + modals)
├── manifest.json         # PWA manifest (name, icons, theme)
├── service-worker.js     # Offline app-shell caching
├── schema.sql            # Run this once in the Supabase SQL editor
├── css/
│   └── styles.css        # KTX 3PL theme
├── js/
│   ├── config.js         # ← Put your Supabase URL + anon key here
│   ├── supabase.js       # Creates the Supabase client (window.db)
│   ├── auth.js           # Login / signup / logout + session handling
│   └── app.js            # Projects, records, attachments
└── icons/
    ├── logo.svg          # In-app logo (auth screen + top bar)
    ├── icon-192.png      # ← Replace with your real PNG icon
    └── icon-512.png      # ← Replace with your real PNG icon
```

## Setup

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project
   (the free tier is fine).
2. Wait for the project to finish provisioning.

### 2. Run the database schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the entire contents of `schema.sql` and click **Run**.

This creates:

- Tables: `profiles`, `projects`, `inbound_records`, `outbound_records`,
  `attachments`.
- A trigger that auto-creates a profile row when a user signs up.
- Row Level Security policies (shared-warehouse model: any signed-in user has
  full read/write access).
- A **private** Storage bucket named `paperwork` with access policies.

### 3. Add your Supabase credentials

1. In the dashboard go to **Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `js/config.js` and paste them in:

   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...your anon key...",
     STORAGE_BUCKET: "paperwork",
   };
   ```

   The anon key is safe to ship in a client app — it is protected by the Row
   Level Security policies created by `schema.sql`.

### 4. Serve the files

The app is just static files, so any static web server works. From the project
folder:

```bash
# Python (built in on macOS/Linux)
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

> A real web server (or HTTPS host) is required — opening `index.html` directly
> via `file://` will not register the service worker and some browser APIs are
> restricted. For production, host the folder on any static host (e.g. Netlify,
> Vercel, GitHub Pages, Cloudflare Pages, or an S3 bucket). HTTPS is required
> for PWA install + service worker on a real domain.

### 5. Create the first account

Open the app, click **Create one** on the login screen, and sign up. If email
confirmation is enabled in your Supabase project (Auth → Providers → Email),
you'll need to confirm via the emailed link before signing in. You can disable
confirmation in the dashboard for quicker internal use.

## Installing as an app (PWA)

- **Desktop (Chrome/Edge):** click the install icon in the address bar, or
  menu → "Install KTX 3PL Warehouse Tracker".
- **iPhone/iPad (Safari):** Share → "Add to Home Screen".
- **Android (Chrome):** menu → "Install app" / "Add to Home Screen".

## Branding / replacing the icons

The in-app logo is `icons/logo.svg` (used on the login screen and the top bar).
The PWA home-screen/taskbar icons are `icons/icon-192.png` and
`icons/icon-512.png`, referenced by `manifest.json`.

To use the real KTX 3PL artwork, replace those two PNG files with square
exports of the logo at **192×192** and **512×512** pixels (keep the same file
names). For best results on Android, leave a little padding around the artwork
since the manifest marks them as `maskable`.

## How permissions work

This is a **shared** warehouse tool: every authenticated user can see and edit
all projects, records, and attachments. The `created_by` / `uploaded_by`
columns record who added each item for an audit trail. If you later need
per-user or per-role restrictions, tighten the RLS policies in `schema.sql`.

## Notes

- Cross-origin requests (the Supabase API and the CDN) are never cached by the
  service worker, so data stays live and authentication keeps working.
- The `paperwork` bucket is private; downloads use signed URLs that expire after
  60 seconds.
