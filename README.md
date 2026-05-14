# Apertures

A travel companion for Rhett. Three letters and a journal anchored to Jefferson's eight objects of attention. Built as a static site, deployed to GitHub Pages, **works fully offline once installed**.

## What's inside

- **The Card** — a personal note from Wil
- **Hints, 2026** — a modernized version of Jefferson's 1788 travel letter
- **Hints, 1788** — the original Jefferson letter from the Founders Archive
- **Plan** — trip dates and a city list, each city taggable with the eight objects
- **Journal** — eight sections (Agriculture, Mechanical arts, Lighter arts, Gardens, Architecture, Painting, Politics, Courts). Entries hold a title, date, location, notes, and any number of photos.

All data lives in the device's IndexedDB. Nothing leaves the phone. Export to JSON to back up.

## Offline behavior

A service worker (`sw.js`) caches the entire app shell on first visit. After that:

- The app opens with **no signal and no wifi**. Letters, plan, journal, photos — all work.
- New journal entries save to IndexedDB (on-device). They sync to nothing, they just stay there.
- The export/import JSON flow is the only way data leaves or enters the device.
- When Rhett gets back to wifi, opening the app refreshes any updated files in the background. He doesn't have to do anything.

The first visit needs internet (to download the app + fonts). Every visit after that, including airplane mode on the TGV through France, works.

## Run locally

The app uses `fetch()` to load the letter partials, so it needs an HTTP server (not `file://`).

```powershell
cd C:\Users\WilCosgrove\Desktop\local-ai-dev\.scratch\.random-html\rhett-graduation
python -m http.server 8000
```

Open <http://localhost:8000>.

## Deploy to GitHub Pages

1. Create a public repo on GitHub (suggested name: `apertures`)
2. From this folder:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/apertures.git
   git push -u origin main
   ```
3. In the repo's **Settings → Pages**, set:
   - Source: **Deploy from a branch**
   - Branch: **main**, folder: **/ (root)**
4. After a minute or two, the site will be live at `https://<your-username>.github.io/apertures/`
5. Share the link with Rhett. On his iPhone, tap the share icon and "Add to Home Screen." It will install with the Apertures icon and launch full-screen.

## Files

```
.
├── index.html              app shell, all views
├── styles.css              design tokens, components, light/dark
├── app.js                  router, journal, plan, photo pipeline, settings
├── db.js                   IndexedDB wrapper
├── manifest.json           PWA manifest
├── content/
│   ├── card.html
│   ├── letter-2026.html
│   └── letter-1788.html
├── assets/
│   ├── icon.svg            scalable icon source
│   ├── icon-192.png        PWA icon
│   ├── icon-512.png        PWA icon
│   ├── icon-1024.png       PWA icon (high-res)
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   ├── topo.svg            topographic background pattern
│   └── _gen_icons.py       regenerate PNG icons from the design (Pillow)
└── README.md
```

## Editing the letters

The three letter texts live in `content/`. Each is a standalone HTML fragment with semantic structure (`<article>`, `<section>`, `<h1>`, etc.) — edit them directly and the app picks up the changes on reload.

## Editing the journal objects

The eight objects and their excerpts are defined at the top of `app.js` in the `OBJECTS` constant. Keep the slugs in sync with the `href="#/journal/<slug>"` links in `index.html` if you change them.

## Regenerating icons

```powershell
python assets\_gen_icons.py
```

Requires Pillow (`pip install pillow`).

## Tech choices

- Vanilla HTML, CSS, ES modules. No bundler, no framework. The whole app is under ~30 KB minified and loads instantly on any phone.
- IndexedDB (not localStorage) for photos — localStorage caps at ~5 MB and gets cleared by Safari.
- Photos are client-side resized to 2048px max and JPEG quality 0.85 before storage; thumbnails are stored alongside for fast list rendering.
- W&M palette: brick green `#115740`, old gold `#B9975B`, cream `#FAF6EE`.
- Type: Bodoni Moda for the letters and headlines (Jefferson's contemporary, Giambattista Bodoni); Inter for UI.
