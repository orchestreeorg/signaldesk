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

## What is wired

- `pnpm bot` is Telegram-only. Dry-run does not poll.
- `pnpm worker` registers `noop`, `tape`, `news`, the DIGEST clock, a news poll every 5 minutes, and a tape OI tick every minute. Collectors never send Telegram. Set `NEWS_LIVE=1` for RSS + Farside. Set `TAPE_LIVE=1` for Binance USDT-M websockets (CVD, liquidations, funding) and OI REST; marks persist to `price_marks`. News desk uses that snapshot instead of a quiet tape. Flow z-scores stay null until a Glassnode adapter exists.
- Features: CVD, funding, OI, vol regime. Flow z-scores stay null until a real adapter exists.
- Classify: LLM extracts class/assets/polarity/novelty/credibility (mocked in tests). No probabilities.
- Fusion + policy: FLASH / FADE / CONFIRM / INVALIDATE. Only `Policy` / `sendAlert` send. 4 FLASH/day, one CONFIRM per thesis.
- Outcomes: four horizon returns from `price_marks`. Missing marks stay null.
- Priors: SQL event study when N≥20, else global. `CLASS_PRIORS` is fallback.
