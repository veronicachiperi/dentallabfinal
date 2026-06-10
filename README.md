# Laborator Dentar — Prototip

Static HTML/CSS/JS prototype of a dental laboratory workflow system. Replaces the Monday.com setup with a cleaner, simpler interface.

## What's included

- **Public landing page** (`index.html`, also available as `landing.html`) — first page visitors see at `privatecad.md`
- **Login screen** (`login.html`) — pick a role (Admin, Tehnician, Clinică) to land on the right starting page
- **Pipeline board** (`dashboard.html`) — kanban view of all cases by stage, with notification panel, deadline alerts, working filters (Toate / Mele / Întârziere / Săptămâna), drag-and-drop between stages, search, and clickable Probă status pill (La lab → La clinică → Înapoi la lab)
- **Clinic portal** (`clinic.html?id=crisdent`) — what each clinic sees: their cases only, with Aprobă / Adaugă notă actions, and a "+ Caz nou" button
- **Case detail** (`case.html?id=141`) — single case page with timeline, notes, fișă upload + auto-generate PDF, attached files, and "Etapă următoare" button
- **Calendar view** (`calendar.html`) — monthly grid showing cases by deadline, navigate prev/next month
- **Statistics dashboard** (`stats.html`) — KPIs and 4 live charts: cases per stage, per clinic, per work type, on-time delivery rate
- **+ Caz nou modal** — accessible from the pipeline topbar and clinic portal; full form to create a new case

All data is in `js/data.js` (real cases from your April 2026 board). Runtime changes (probă status switches, stage moves, new cases, notes added) persist in `localStorage`.

## Mobile friendly

The whole app collapses gracefully on phone screens: sidebar becomes a hamburger menu, pipeline columns stack vertically, modal goes full-screen, calendar shrinks. Test by opening dev tools and toggling responsive mode.

## Running locally

Open `index.html` directly in a browser for the public landing page, or serve from a local server:

```bash
# any of these works
python3 -m http.server 8000
npx serve
```

Then visit `http://localhost:8000` for the landing page or `http://localhost:8000/dashboard.html` for the internal dashboard.

## Editing in VS Code

1. Open the `dental-lab` folder in VS Code.
2. Install the **Live Server** extension for hot-reload while editing.
3. Right-click `index.html` → "Open with Live Server".

Recommended VS Code extensions:
- Live Server
- Prettier
- HTML CSS Support

## Deploying to Netlify via GitHub

### 1. Create the GitHub repo

```bash
cd dental-lab
git init
git add .
git commit -m "Initial dental lab prototype"
git branch -M main

# Replace <username> and <repo-name> with yours
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

### 2. Connect to Netlify

1. Go to [netlify.com](https://netlify.com) and sign in (GitHub login is fastest).
2. Click **Add new site → Import an existing project → GitHub**.
3. Choose your repo.
4. Build settings: leave everything as default. The `netlify.toml` in this folder tells Netlify to publish the root directory.
5. Click **Deploy**.

Within ~30 seconds you'll have a live URL like `your-site-name.netlify.app`.

### 3. Custom domain (optional)

In Netlify: **Domain settings → Add custom domain**. Point your DNS at Netlify per their instructions. HTTPS is automatic via Let's Encrypt.

## Project structure

```
dental-lab/
├── index.html          # Public landing page served at privatecad.md
├── landing.html        # Same landing page kept as a direct URL
├── dashboard.html          # Pipeline board (employee view)
├── clinic.html         # Clinic portal
├── case.html           # Case detail + fișă section
├── css/
│   └── styles.css      # Minimal flat design system
├── js/
│   ├── data.js         # Demo cases, clinics, employees, notifications
│   └── app.js          # Rendering, filters, probă switch, PDF generation
├── netlify.toml        # Netlify config
├── .gitignore
└── README.md
```

## Try it

Once running, try these:

- Type "cecan" or "141" in the search bar at the top
- Click the small Probă pill on a case in the Probă column — it cycles La lab → La clinică → Înapoi la lab and remembers the change
- Click a case card → view details → scroll to "Fișă de laborator" → click "Generează PDF" to download an auto-generated work order
- Visit `/clinic.html?id=fav` (or change the id to crisdent / elite / pana / esthetic) to see the per-clinic portal
- Add a note in the case detail page — it stays in the page until reload (then resets to seed notes)

## Next steps when you're ready for a real backend

This prototype uses hardcoded data and `localStorage`. To make it multi-user with real persistence, the natural upgrades are:

1. **Backend**: Supabase (Postgres + auth + storage + realtime — free tier is generous) or a small Node/Express server.
2. **File storage**: Zoho WorkDrive via its REST API (your existing storage), or Supabase Storage if you want it bundled.
3. **Auth**: Supabase Auth handles email login, magic links, and per-clinic / per-employee roles in a few lines.
4. **Notifications**: Supabase Realtime for in-app push; add Telegram bot for mobile alerts.

The data shape in `js/data.js` is already aligned with what a Postgres schema would look like, so the migration is mostly mechanical.

---

Built with no framework, no build step, no dependencies (except jsPDF from CDN for PDF generation).
 
