# Errand Boy — Engineering Handover

> **Premium Lagos concierge & logistics web app.** Market runs, vetted chauffeurs, dispatch riders, and luxury laundry — with live map tracking, an in-app wallet, utility bill payments, and an AI runner chat. Real authentication and persistent, per-user state on AWS.

This document is the single source of truth for a new engineer taking over. Read it top to bottom once; everything you need to run, deploy, and extend the product is here.

---

## 1. TL;DR — current state

- **Live app (share/demo):** https://baye6ix.github.io/errand-boy/  → the app dashboard
- **Marketing landing page:** https://baye6ix.github.io/errand-boy/landing.html
- **Demo login** (skips email verification): `demo@errandboy.app` / `Demo#2026x`
- **Repo:** https://github.com/baye6ix/errand-boy (public; hosts frontend on GitHub Pages)
- **Backend:** live on AWS account **272436634988**, region **eu-west-1**
- **Stack:** static frontend (vanilla HTML/CSS/JS) + Cognito auth + API Gateway (HTTP) + Lambda (Python) + DynamoDB + Secrets Manager, all defined as code in `infra/`.
- **What works end-to-end (verified):** sign up / sign in, wallet fund/debit, book errand, live map tracking, errand completion, transaction history — all persisted per-user and surviving reloads.

**Maturity:** MVP / working product. Real auth + data + payments-as-wallet. Not yet: real money rails (Paystack/Flutterwave), real courier dispatch, production email (SES), observability/alarms.

---

## 2. Architecture

```
Browser (GitHub Pages, static)
  ├── config.js      public IDs (Cognito pool/client, API base URL)
  ├── auth.js        Cognito sign-up/confirm/sign-in via REST (no SDK, no secret)
  ├── api.js         fetch wrapper, attaches Cognito JWT as Bearer
  ├── app.js         all UI logic + the auth gate + cloud state
  ├── index.html     the app (dashboard, tracker, wallet, utilities, chat)
  └── landing.html   marketing front door → links into index.html

        │  HTTPS + JWT (Authorization: Bearer <IdToken>)
        ▼
API Gateway HTTP API  (JWT authorizer validates Cognito tokens)
        │  AWS_PROXY (payload v2)
        ▼
Lambda  ErrandBoy-Api  (Python 3.12, single handler, routes on method+path)
        ├── DynamoDB: ErrandBoy-Errands / -Transactions / -Wallets
        └── Secrets Manager: errand-boy/gemini  (AI chat key)
                └── Google Gemini API (server-side proxy for runner chat)

Cognito User Pool  ErrandBoy-Users  → issues the JWTs the API trusts
```

**Key design choices**
- **User identity = the JWT `sub`**, extracted server-side. The client never sends its own userId — no spoofing.
- **Credentials never live in the repo.** AWS creds are in `~/.aws/credentials` (profile `errand-boy`); the Gemini key is in Secrets Manager. Only *public* IDs (Cognito client id, API URL) are in `config.js`, which is normal for a SPA.
- **Infra is code.** Everything was created via boto3 scripts in `infra/`, re-runnable and idempotent.

---

## 3. Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | The app: header/wallet, services, live tracker, utilities, chat, modals, **auth gate** |
| `landing.html` / `landing.css` | Marketing landing page (linked into the app) |
| `style.css` | Design system (obsidian + ember theme, **Plus Jakarta Sans** — Chowdeck's typeface) |
| `app.js` | UI logic, tracking sim, auth gate, cloud-state wiring |
| `config.js` | Public frontend config (Cognito ids, API base URL) |
| `auth.js` | Cognito auth via the public REST API |
| `api.js` | Authenticated API helper (JWT bearer) |
| `favicon.svg` | Brand emblem |
| `lambda/handler.py` | The entire backend API (one Lambda, 8 routes) |
| `infra/foundation.yaml` | CloudFormation: DynamoDB tables + Cognito pool/client |
| `infra/deploy.py` | Deploy/update the foundation stack (boto3) |
| `infra/deploy_api.py` | Deploy Lambda + HTTP API + JWT authorizer + routes + CORS |
| `infra/outputs.json` | Resource IDs from the last deploy (pool id, api url, table names) |
| `aws/iam-policy-errand-boy.json` | Least-privilege deploy policy (source of `ErrandBoyDeployPolicy`) |
| `aws/claude-in-chrome-prompt.md` | Guided prompt used to mint the scoped IAM user |
| `tests/api_e2e.py` | End-to-end API test (Cognito login → all routes → DynamoDB) |
| `serve.ps1` | Zero-dependency local static server (PowerShell) |
| `upload.ps1` | Legacy: push files to GitHub via REST (superseded by git) |
| `.github/workflows/ci.yml` | CI (smoke tests). **Currently gitignored** — see §9 |
| `task.md` | Running task log / checklist |

---

## 4. Running locally

**Frontend only (no backend changes needed):**
```bash
./serve.ps1                 # serves http://localhost:8080  (PowerShell)
# or:  python -m http.server 8080
```
Open http://localhost:8080/ and sign in with the demo account. The frontend talks to the **live** AWS backend, so local edits to HTML/CSS/JS work against real data.

**Tooling note:** this machine has **no Node / AWS CLI / SAM / CDK**. Backend work uses **Python 3.12 + boto3**. Install once: `python -m pip install --user boto3`.

---

## 5. AWS — resources & how to deploy

**Account:** 272436634988 · **Region:** eu-west-1 · **Profile:** `errand-boy`

| Resource | Name / ID |
|----------|-----------|
| DynamoDB (errands) | `ErrandBoy-Errands` (PK userId, SK errandId) |
| DynamoDB (transactions) | `ErrandBoy-Transactions` (PK userId, SK txnId) |
| DynamoDB (wallets) | `ErrandBoy-Wallets` (PK userId) |
| Cognito User Pool | `eu-west-1_eeVxRxgIT` |
| Cognito Web Client | `athmjm4kjutfrl7lgf38aa4du` (no secret) |
| Lambda | `ErrandBoy-Api` (python3.12, handler.handler) |
| API Gateway (HTTP API) | base `https://80immefbhk.execute-api.eu-west-1.amazonaws.com` |
| Secrets Manager | `errand-boy/gemini` (Gemini API key; placeholder until set) |
| IAM role (Lambda) | `ErrandBoy-LambdaRole` |
| CloudFormation stack | `errand-boy-foundation` |

**Redeploy after changes:**
```bash
python infra/deploy.py       # DynamoDB + Cognito (rarely changes)
python infra/deploy_api.py   # Lambda code + API routes (run after editing lambda/handler.py)
```
Both are idempotent. `deploy_api.py` re-zips `lambda/handler.py`, updates the function, and ensures all routes/authorizer/permissions exist. It reads/writes `infra/outputs.json`.

**Costs:** DynamoDB on-demand, Lambda, API Gateway, and Cognito are all effectively **$0 at demo volume**. Secrets Manager ≈ **$0.40/mo** per secret. GitHub Pages is free. No always-on servers.

---

## 6. API reference

Base URL: `https://80immefbhk.execute-api.eu-west-1.amazonaws.com`
All routes require `Authorization: Bearer <Cognito IdToken>` (CORS preflight excepted).

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET  | `/wallet` | — | `{balance}` (auto-creates at 0) |
| POST | `/wallet/fund` | `{amount}` | `{balance}` + records credit txn |
| POST | `/wallet/debit` | `{amount,title}` | `{balance}` or 402 if insufficient |
| GET  | `/errands` | — | `{errands:[...]}` |
| POST | `/errands` | `{type,cost}` | `{errand,balance}` (debits wallet) or 402 |
| POST | `/errands/complete` | `{errandId}` | `{ok:true}` (status→Delivered) |
| GET  | `/transactions` | — | `{transactions:[...]}` |
| POST | `/chat` | `{message,system?,history?}` | `{configured,reply}` — Gemini proxy |

Test all of them: `python tests/api_e2e.py` (creates a temp user, exercises every route, cleans up).

---

## 7. Auth flow

1. **Sign up** → Cognito emails a 6-digit code (default Cognito email — see §8 SES caveat).
2. **Confirm** with the code → **Sign in** (USER_PASSWORD_AUTH) → app stores `{idToken, refreshToken, exp}` in `localStorage` (`eb_auth`).
3. `api.js` attaches the id token; it auto-refreshes via the refresh token when expired.
4. The app is hidden behind `#auth-gate` until authenticated (`body.authed`).

Demo account is pre-confirmed so it skips the email step.

---

## 8. What's left (prioritized roadmap)

1. **Activate AI chat** — put a real Gemini key in the secret (one command, no deploy):
   ```bash
   python -c "import boto3;boto3.Session(profile_name='errand-boy').client('secretsmanager').put_secret_value(SecretId='errand-boy/gemini',SecretString='{\"apiKey\":\"YOUR_GEMINI_KEY\"}');print('set')"
   ```
   Get a key at https://aistudio.google.com/apikey. The frontend already prefers the proxy and falls back gracefully, so nothing else changes.
2. **Real signup emails (SES)** — Cognito currently uses its default email sender (sandbox limits, may land in spam). Move to Amazon SES with a verified domain, and request SES production access. Needed before onboarding real users at scale.
3. **Real payments** — wallet is real but funded with fake money. Integrate **Paystack or Flutterwave** (Nigeria-native) via a backend endpoint + webhooks. Same for utility bills (a VTU aggregator like VTpass).
4. **Real courier dispatch** — tracking is a client-side simulation over real Lagos coordinates. Replace with a runner app + live location feed (API Gateway WebSockets or AWS IoT) writing to the errand record.
5. **Observability & hardening** — CloudWatch alarms, structured logs, request validation, rate limiting, and tighten the IAM policy from `*` to specific ARNs.
6. **Custom domain + move hosting** — optional: S3 + CloudFront + Route 53 for a branded domain instead of `github.io`.

---

## 9. Known gotchas / tech debt

- **CI is not on GitHub.** `.github/workflows/ci.yml` exists locally but is gitignored, because the `gh` token used lacked the `workflow` scope. To enable: `gh auth refresh -s workflow`, remove `.github/workflows/` from `.gitignore`, commit, push.
- **Root AWS key exposure.** A root access key (`AKIAT63T5EVWGGBT3G6X`) was created early and must be **deleted in the IAM console** (root user → Security credentials). The project does **not** use it — everything runs on the scoped `errand-boy-deploy` user. A local fallback copy sits in the `errand-boy-root` profile; delete it once the console key is gone.
- **IAM policy is broad.** `ErrandBoyDeployPolicy` grants `service:*` per service (scoped to the services used, not resource-level). Fine for MVP; tighten for production.
- **Single Lambda, single table-per-entity.** Simple and cheap; revisit if the domain grows (consider single-table design + per-domain functions).
- **Gemini via browser key still exists** as a fallback path in `app.js` (users can paste their own key). Harmless; remove once the server proxy has a key.

---

## 10. Handover checklist (access the new owner needs)

The code and infra are self-documenting, but these grants only the account owner can give:

- [ ] **GitHub:** add the cofounder as a collaborator on `baye6ix/errand-boy` (Settings → Collaborators).
- [ ] **AWS:** give them access to account 272436634988. Best practice — create them their **own IAM user** (don't share the `errand-boy` key). They can attach `ErrandBoyDeployPolicy` for deploy rights. Then they set up their own `~/.aws/credentials` profile.
- [ ] **Google AI Studio:** share/generate a Gemini API key if they'll work on the AI chat.
- [ ] **Delete the exposed root key** (see §9) — do this before/at handover.
- [ ] Point them at this file and `task.md`.

---

## 11. Design & brand

- **Type:** Plus Jakarta Sans everywhere (chosen to match Chowdeck's brand typeface).
- **Theme:** "Obsidian + ember" — near-black surfaces, orange→amber accent gradient, gold VIP accents, glass cards, subtle motion.
- **Logo:** ƎB emblem tile (gold "prestige pip") + two-tone "ERRAND BOY" wordmark + "Concierge · Lagos" kicker. Assets: `favicon.svg` + CSS in `style.css`.

---

_Last updated at handover. Questions the code can't answer are in `task.md`'s running log and the git history (`git log`)._
