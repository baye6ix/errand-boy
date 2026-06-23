# Errand Boy — Developer Handover

> Premium Lagos concierge & logistics web app (market runs, chauffeur hire, dispatch, luxury laundry) with a live errand tracker, wallet, utility bill payments, and an AI runner chat powered by Gemini 2.5 Flash.

**Status:** Working front-end prototype (static site). No backend, no persistence, no auth, no payments. Everything is simulated in the browser.

---

## 1. File Inventory

| File | Type | Purpose |
|------|------|---------|
| `index.html` | UI markup | Single-page app shell: header/wallet, hero stats, service catalog, live tracker (canvas map), utility hub, chat drawer, and all modals (booking, wallet, API-key). |
| `style.css` | Styling | "Obsidian" dark glassmorphic theme, layout grid, animations, responsive rules. *(Not yet reviewed line-by-line — referenced by `index.html`.)* |
| `app.js` | Logic | All client state and behavior: booking, wallet top-up, utility payments, simulated tracking engine, canvas map + GPS interpolation, chat drawer, and the `callGeminiAPI()` integration. |
| `errand_boy_ios_launch.png` | Asset | Launch/marketing screenshot (iOS-style). Not referenced in code. |
| `serve.ps1` | Dev script | Zero-dependency PowerShell static file server on `http://localhost:8080`. |
| `upload.ps1` | Dev script | Pushes all files to a GitHub repo via the REST API (reads `.env`). |
| `.env` | Config | `GITHUB_TOKEN` (placeholder) + `GITHUB_REPO=baye6ix/errand-boy`. **No real secret committed.** |
| `README.md` | Docs | One-line stub. |
| `task.md` | Docs | Checklist of completed Gemini-chat integration tasks. |
| `implementation_plan.md` | Docs | Design doc for the Gemini chat feature. |
| `walkthrough.md` | Docs | Narrative of what was built and how to verify it. |
| `HANDOVER.md` | Docs | This document. |

---

## 2. How to Run Locally

```powershell
# from the project root
./serve.ps1
# then open http://localhost:8080/
```

The Gemini chat is optional: open the chat drawer → 🔑 → paste a Gemini API key (stored in `localStorage`, never sent anywhere but Google). Without a key, the runner replies with canned fallback lines.

---

## 3. Architecture (current)

- **100% client-side.** No build step, no framework, no bundler — plain HTML/CSS/JS.
- **State** lives in one `state` object in `app.js`; lost on refresh.
- **"Live tracking"** is a `setInterval` walking through scripted stages + a `requestAnimationFrame` canvas animation that interpolates GPS coords along a fixed Lagos route.
- **Gemini chat** calls `generativelanguage.googleapis.com` directly from the browser with the user's own key.
- **Wallet, payments, utilities** mutate the in-memory balance only — nothing is charged or persisted.

---

## 4. What's Missing (gaps → concrete actions)

| Gap | Why it matters | Concrete action |
|-----|----------------|-----------------|
| **No backend** | Payments, bookings, and AI keys can't be trusted/persisted client-side | Stand up an API (recommend AWS — see §5). |
| **No persistence** | Refresh wipes everything | DynamoDB (or RDS Postgres) for users, errands, wallet, transactions. |
| **No auth** | "VIP client" is hardcoded | Amazon Cognito (email/phone OTP) — fits the Lagos phone-first audience. |
| **AI key exposed in browser** | A real key would be stealable; per-user keys don't scale | Proxy Gemini through a backend Lambda; store one server key in AWS Secrets Manager. |
| **Fake payments** | No real money movement | Integrate Paystack/Flutterwave (Nigeria-native) via backend webhooks. |
| **Fake utilities** | Airtime/power/cable are mocked | Integrate a VTU/bills aggregator (e.g. VTpass/Flutterwave Bills). |
| **No real maps/GPS** | Canvas is schematic only | Mapbox or Google Maps JS SDK + real runner location feed. |
| **No build/CI** | Manual `upload.ps1` only | Add GitHub Actions: lint + deploy to S3/CloudFront on push. |
| **No tests** | Nothing guards regressions | Add Playwright smoke tests (book → track → chat) + unit tests for cost logic. |
| **No error/observability** | Failures are silent toasts | CloudWatch logs + a client error reporter. |
| **No favicon / meta / SEO / a11y pass** | Production polish | Add favicon, OG tags, alt text, keyboard focus states. |
| **Secrets hygiene** | `.env` is committed | Add `.gitignore` (`.env`, `node_modules`), keep only `.env.example`. |

---

## 5. Suggested AWS Build-Out (where your keys help)

A lean, low-cost serverless stack that fits this app:

1. **Hosting:** S3 (static site) + CloudFront (CDN/HTTPS) + Route 53 (custom domain).
2. **API:** API Gateway (HTTP API) → Lambda (Node.js/TypeScript).
3. **Data:** DynamoDB (users, errands, wallet, transactions).
4. **Auth:** Cognito user pool (phone/email OTP).
5. **AI proxy:** Lambda endpoint that injects the system prompt and calls Gemini using one server-held key in **Secrets Manager** — browser never sees it.
6. **Realtime tracking:** API Gateway WebSockets (or AWS IoT) to stream runner location → live map.
7. **Notifications:** SNS / Amazon Pinpoint for SMS/push errand updates.
8. **IaC + CI:** AWS SAM or CDK, deployed via GitHub Actions (OIDC role — no long-lived keys in CI).

**To start, I'll need (least-privilege):** an IAM user/role scoped to S3, CloudFront, Lambda, API Gateway, DynamoDB, Cognito, Secrets Manager, and CloudWatch — plus your preferred AWS region (e.g. `eu-west-1` / `af-south-1` for lower Lagos latency). Provide via the credentials file or env vars, **not** pasted in chat.

> Note: Gemini is a Google service, not AWS. The AWS Lambda would still call Google's Gemini API with a Google key (or we switch the chat to Amazon Bedrock if you'd prefer an all-AWS stack).

---

## 6. Recommended Next Steps (phased)

1. **Phase 0 — Hardening (no backend):** add `.gitignore`, favicon/meta, basic a11y, Playwright smoke test, GitHub Actions deploy to S3/CloudFront.
2. **Phase 1 — Backend foundation:** Cognito auth + DynamoDB + API Gateway/Lambda; move errands & wallet server-side.
3. **Phase 2 — Real integrations:** Paystack/Flutterwave payments, VTU bills, Gemini-via-Lambda proxy.
4. **Phase 3 — Realtime & maps:** Mapbox + WebSocket runner location, SMS/push notifications.
5. **Phase 4 — Ops:** monitoring, alarms, load test, security review, launch.
