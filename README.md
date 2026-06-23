# Errand Boy

Premium **Lagos concierge & logistics** web app — market runs, vetted chauffeurs, dispatch riders, and luxury laundry — with a live errand tracker, an in-app wallet, utility bill payments, and an AI runner chat powered by Gemini 2.5 Flash.

> **Status:** Front-end prototype. Tracking, payments, and utilities are simulated in the browser; the AI chat is real (uses your own Gemini key). See [HANDOVER.md](HANDOVER.md) for the full architecture, gaps, and production roadmap.

## Run locally

```powershell
./serve.ps1          # serves at http://localhost:8080
```

Or with any static server, e.g. `python3 -m http.server 8080`.

Optional: open the chat drawer → 🔑 → paste a [Gemini API key](https://aistudio.google.com/apikey) to enable AI runner replies. The key is stored only in your browser's `localStorage`.

## Tests

```bash
npm install
npx playwright install --with-deps chromium
npm test             # runs the Phase 0 smoke tests in tests/
```

CI runs the same smoke tests on every push/PR (`.github/workflows/ci.yml`).

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | App markup & all modals |
| `app.js` | State, booking, tracking, canvas map, chat, wallet, utilities |
| `style.css` | Obsidian dark glassmorphic theme |
| `serve.ps1` | Local static server |
| `upload.ps1` | Push files to GitHub via REST API |
| `tests/` | Playwright smoke tests |
| `HANDOVER.md` | Developer handover & production roadmap |

## Roadmap

Phased plan (AWS-based backend) is in [HANDOVER.md](HANDOVER.md): hardening → backend foundation → real payments/AI → realtime maps → ops & launch.
