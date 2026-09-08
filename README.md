# signal-desk

BTC/ETH research desk. News + tape in, probabilities out, Telegram only. No trading. No dashboard.

## Requirements

- Node 22 + pnpm
- Docker or Colima (Postgres 16 + Redis 7)

## Runbook

```bash
colima start                      # after reboot, if Docker Desktop is not running
docker-compose up -d              # or: docker compose up -d
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm test
pnpm job:once                     # prints dry-run: 0 events
pnpm worker                       # tape + news + DIGEST clock
pnpm dash                         # ops console at http://localhost:3100
pnpm bot                          # long-poll only when TELEGRAM_DRY_RUN=0 and token set
```

Postgres is on **5433** (container 5432) so it does not collide with Homebrew on 5432. Redis stays on 6379.

### Phone ping

1. Create a bot with BotFather. Put the token and your chat id in `.env` only.
2. Set `TELEGRAM_DRY_RUN=0`.
3. `pnpm smoke` sends one dummy FLASH, then one DIGEST.
4. `pnpm bot` long-polls commands (`/start` `/watch` `/mute` …).
5. `pnpm worker` registers DIGEST at **00:00 / 08:00 / 16:00 UTC**.

`.env` is gitignored. Do not commit tokens.

## Ops dashboard

`pnpm dash` is a Next.js console (Vercel-ready root: `dashboard/`). It tails structured worker logs from Redis: fetches, source skips, fusion holds, Telegram sends, and the wait until the next news / tape / DIGEST cron.

Start/Stop from the UI only works on a machine that can spawn `pnpm worker`. Vercel cannot run BullMQ or the Binance websocket. Deploy the dashboard with a **hosted** `REDIS_URL` (not localhost). The worker stays on a long-lived host that uses the same Redis.

Optional `DASH_SECRET` must be sent as `x-dash-secret` on `/api/control`.

## What is wired

- `pnpm bot` is Telegram-only. Dry-run does not poll.
- `pnpm worker` registers `noop`, `tape`, `news`, the DIGEST clock, a news poll every 5 minutes, and a tape OI tick every minute. Collectors never send Telegram. Set `NEWS_LIVE=1` for RSS + Farside. Set `TAPE_LIVE=1` for Binance USDT-M websockets (CVD, liquidations, funding) and OI REST; marks persist to `price_marks`. News desk uses that snapshot instead of a quiet tape. Flow z-scores stay null until a Glassnode adapter exists.
- Features: CVD, funding, OI, vol regime. Flow z-scores stay null until a real adapter exists.
- Classify: LLM extracts class/assets/polarity/novelty/credibility (mocked in tests). No probabilities.
- Fusion + policy: FLASH / FADE / CONFIRM / INVALIDATE. Only `Policy` / `sendAlert` send those. Caps and thresholds live in `desk_settings` (defaults: 4 FLASH/day, cred 0.7). One CONFIRM per thesis.
- Headlines: each first-seen RSS/HTML item also gets a short Telegram ping (`sendHeadline`: source · BULLISH/BEARISH/NEUTRAL, title, URL). Tone is title-only. `tone_mode` + `headline_send` decide how many pings go out (loose/all = more; strict/skip_neutral = fewer). Not an AlertKind. Dedup is `persistRawItems`. Mute does **not** block headlines. Collectors never send.
- Parameters: dashboard `/parameters` edits `news_sources` and `desk_settings` in Postgres. Secrets stay in `.env`. Save applies on the next news job.
- Outcomes: four horizon returns from `price_marks`. Missing marks stay null.
- Priors: SQL event study when N≥20, else global. `CLASS_PRIORS` is fallback.
