# Task List - Gemini AI Chatbot Integration

- [x] Update UI Layout (`index.html`)
  - [x] Add `🔑` settings button in the chat drawer header
  - [x] Add API Key configuration modal at the bottom
  - [x] Add inline warning banner for missing key in chat messages box
  - [x] Add real-time GPS coordinate display field in ETA row
- [x] Add Premium Styling (`style.css`)
  - [x] Style the chat header action layout and the `🔑` button
  - [x] Style the Gemini key configuration modal
  - [x] Style the missing API key notice banner and typing indicators
- [x] Implement Application Logic (`app.js`)
  - [x] Manage API key lifecycle (load from/save to/clear from `localStorage`)
  - [x] Setup API key modal open/close actions
  - [x] Maintain chat history in the active errand state
  - [x] Implement client-side `callGeminiAPI(userMessage)` function using fetch
  - [x] Update chat send handler to route messages to Gemini API when a key is present and handle typing indicator
  - [x] Create system instruction prompt adapted to the errand context and Lagos runner persona
  - [x] Define actual Lagos GPS coordinates and animate coordinate interpolation along the active route
- [x] Verify Features
  - [x] Ensure key saving works and is stored in localStorage
  - [x] Test chat flow with and without the Gemini API Key
  - [x] Verify real-time GPS coordinate tracing on the live tracking card

---

# Phase 0 - Production Hardening (no backend / no credentials)

- [x] Secrets hygiene: add `.gitignore` (ignores `.env`, `node_modules`) + `.env.example`
- [x] Branding: add `favicon.svg` (ƎB monogram) and link it in `index.html`
- [x] SEO/social: add meta description, theme-color, and Open Graph / Twitter tags
- [x] Accessibility: aria-labels on icon-only buttons, location select, canvas; role/aria-modal on dialogs; aria-hidden on decorative icons
- [x] Tests: Playwright smoke tests (`tests/smoke.spec.js`) + `playwright.config.js` + `package.json`
- [x] CI: GitHub Actions workflow running smoke tests on push/PR (deploy job scaffolded, disabled until AWS)
- [x] Docs: expand `README.md`, write `HANDOVER.md`
- [ ] Run the smoke suite locally to confirm green (needs `npm install` + Playwright browsers)

# Design Pass - Full Styling Overhaul (style.css)

- [x] Rebuild design tokens: obsidian surfaces, ember gradient, gold, refined text/lines, motion + shadow scale
- [x] Ambient aurora background + fine grain overlay; global focus-visible ring; selection color
- [x] Hero: Unbounded display headline with gradient, animated ember bloom
- [x] Service cards: ember icon chips, hover top-accent line, sheen sweep, lift shadow
- [x] Live tracker: map grid background, shimmering progress bar, glowing active timeline bullet
- [x] Premium ember buttons with sheen sweep (book/submit/send)
- [x] Chat drawer: gradient header, online-status avatar dot, refined bubbles + notice banner
- [x] Modals/wallet/credit card: layered shadows, gold gradient brand, 3D card tilt on hover
- [x] prefers-reduced-motion support; responsive breakpoints retained
- [x] Verified live in preview across dashboard, modal, active tracker, and chat states (no broken hooks)

# Landing Page (editorial luxury serif)

- [x] Add Playfair Display font + `--font-serif` shared token
- [x] `landing.css`: nav, hero, trust marquee, stats, services, how-it-works, features, testimonial, CTA band, footer (all `lp-` prefixed, reusing ember tokens)
- [x] `landing.html`: full marketing front door; all CTAs link into the app (`index.html`)
- [x] Reveal-on-scroll via IntersectionObserver; reduced-motion + responsive handled
- [x] Verified live: Playfair serif headings, Outfit body, ember accents, 4 services / 3 steps / 4 features / 4 stats, sticky nav, no console errors (full-page screenshot times out only due to 5,530px page height)
- [ ] Optional: decide final home — keep landing.html separate, or promote to index.html and move app to app.html

# AWS Setup (for Phase 1)

- [x] Least-privilege IAM policy (`aws/iam-policy-errand-boy.json`)
- [x] Ready-to-paste Claude-in-Chrome prompt to mint the access key (`aws/claude-in-chrome-prompt.md`)
- [ ] User generates key + drops it into local `.env` (AWS_ACCESS_KEY_ID / SECRET / REGION)

# Phase 1 — AWS backend (IN PROGRESS)
- [x] Credentials isolated in ~/.aws profile `errand-boy` (scoped IAM user, NOT root, not in repo)
- [x] Root key flagged for deletion (user to delete in console; local fallback `errand-boy-root`)
- [x] Foundation stack deployed (infra/foundation.yaml via boto3): DynamoDB (Errands/Transactions/Wallets) + Cognito user pool & client
- [x] Lambda API handler (Python, lambda/handler.py): wallet get/fund, errands list/book, transactions
- [x] API Gateway HTTP API + 5 routes + Cognito JWT authorizer + CORS (infra/deploy_api.py)
- [x] End-to-end verified (tests/api_e2e.py): Cognito login → JWT → API → DynamoDB, wallet math correct, 401 without token
- [x] Added POST /wallet/debit route so utility payments persist too
- [x] Frontend wired: full auth gate (config.js/auth.js/api.js), Cognito sign-up/confirm/sign-in, JWT-authed API calls
- [x] Wallet, errands, transactions now load from + persist to the cloud (verified across page reload)
- [x] Demo account seeded for testing: demo@errandboy.app / Demo#2026x
- [x] Errand lifecycle: POST /errands/complete marks Delivered; tracking completion persists it; in-progress errand restores into the tracker on reload (verified)
- [ ] Gemini-proxy Lambda (key in Secrets Manager) — or Bedrock  [deferred by user]
- [ ] (optional) Move hosting from GitHub Pages to S3 + CloudFront

# Phase 1+ (planned - see HANDOVER.md)
- [ ] AWS backend: Cognito auth, DynamoDB, API Gateway + Lambda (foundation done above)
- [ ] Gemini-via-Lambda proxy (key in Secrets Manager) OR Amazon Bedrock — provider TBD
- [ ] Real payments (Paystack/Flutterwave) + utility bills (VTU aggregator)
- [ ] Realtime tracking (WebSockets + Mapbox), SMS/push notifications
- [ ] Observability, load test, security review, launch
