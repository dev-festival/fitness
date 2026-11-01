# Steady

A personal, single-user space for drinking less, lifting, food macros, body weight, and wellbeing. Built around small choices rather than perfect streaks. MIT licensed.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
npm install
cp .env.example .env.local
npm run dev
```

In PowerShell use `Copy-Item .env.example .env.local`. Open http://127.0.0.1:3000. Local SQLite is created automatically at `data/steady.db`; no account or AI key is required. The dev server binds to loopback. If you expose it on a network, configure a password and session secret first.

## What works

- Ten-minute urge pause, persistent across reloads in the same tab, personal reasons, trigger notes, and intensity logging.
- One daily alcohol/mood/sleep/reflection check-in per date. Updating replaces that day's check-in. Unlogged days never count as alcohol-free.
- Lifting entries with exercise, sets, reps, and load. Log separate entries for sets with different reps or weight; entries on the same date form a session.
- Manual food logging with calories, protein, carbs, and fat, plus editable reference goals.
- Body weight history and sparkline. Units are selected in preferences; conversion of existing history is not supported, so switching units is blocked while weight/lifting entries exist.
- Past-day logging, reflections, deletion of individual records, and JSON backup export.
- Optional stateless AI companion through OpenAI's Responses API. Keys stay server-side. Only the message you submit is sent, without your logs. Responses are not stored in the app; `store: false` is sent to OpenAI, whose own data policies still apply.
- Password sign-in, signed seven-day HttpOnly session cookie, and same-origin checks for writes.

## Deploy to Vercel with hosted SQLite

Vercel's functions do not provide durable local disk. Use a remote SQLite/libSQL database such as [Turso](https://docs.turso.tech/sdk/ts/quickstart). Local file databases are deliberately rejected on Vercel.

1. Create a Turso database and obtain its URL and token.
2. Push this source to your own repository and import it into Vercel as a Next.js project.
3. Configure these environment variables in Vercel:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your `libsql://…` database URL |
| `DATABASE_AUTH_TOKEN` | Your database token |
| `APP_PASSWORD` | A strong unique password for this single-user app |
| `SESSION_SECRET` | At least 32 random characters |
| `OPENAI_API_KEY` | Optional, your own OpenAI API key |
| `OPENAI_MODEL` | Optional, defaults to `gpt-4.1-mini` |

Generate a session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Put secrets in your environment manager, never source control or browser code. Rotate `SESSION_SECRET` to invalidate all sessions. Password and a sufficiently long secret are enforced when `VERCEL` is set. Vercel supplies this variable automatically. For other hosts, set `VERCEL=1` to enforce the same deployment safeguards, or enforce an equivalent private-network boundary.

4. Deploy. Tables and indexes initialize on the first authenticated API request. No seeded or fabricated health records are created.
5. Keep deployment protection enabled where available. This is a small personal app, not a hardened multi-tenant medical service. For internet exposure, add an upstream login rate limiter/WAF rule; the app's login delay is not a distributed rate limiter. Configure provider spend limits for AI usage.

No Vercel/Turso account or production credentials are included, and deploying this repository requires your accounts. This project has not been published to a public repository automatically.

## Privacy and backups

All logs are stored in your own SQLite database. No analytics or advertising. External Google Fonts requests are used for typography; system fonts are the fallback. JSON export in preferences includes all records and settings but no secrets. Export is a portable backup; the first version does not implement JSON restore. Keep exports private. Use Turso backups in production, or back up the local database while the app is stopped. Deletion removes a record from the active database, not any backups you maintain.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

With a local development server running, `node scripts/smoke.mjs` checks real SQLite round trips for every log type, check-in replacement, validation, unit safeguards, and cross-origin rejection. It removes the disposable test records it creates. For a password-protected server, provide a valid signed cookie in `TEST_SESSION` through your environment.

## Care, not treatment

Steady is a personal tracking and reflection tool, not medical care. If you drink heavily or have had withdrawal symptoms, talk with a clinician before stopping abruptly. Severe symptoms such as seizures, hallucinations, or confusion need emergency care. [NIAAA guidance](https://rethinkingdrinking.niaaa.nih.gov/thinking-about-change/cut-down-or-quit) and [treatment navigator](https://alcoholtreatment.niaaa.nih.gov/).

Nutrition goals are editable starter values, not individualized recommendations. All nutrition values are entered manually; there is no food database, barcode scanner, automatic macro estimation, or exercise prescription in this version.
