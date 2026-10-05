import { completeChat } from "../classify/complete.js";
import { formatDeskClock, formatDeskStamp } from "../ops/tz.js";
import type { NearHeadline } from "./nearNews.js";
import type { NearPosition } from "./nearLots.js";
import type { NearQuote } from "./nearPrice.js";
import { simulateNearHoldingsUsd } from "./nearSimulate.js";

export const NEAR_NOTE_HEADLINE_LIMIT = 12;
export const NEAR_NOTE_LOOKBACK_MS = 6 * 60 * 60 * 1000;
export const NEAR_NOTE_MAX_LINES = 220;
export const NEAR_NOTE_MAX_CHARS = 12_000;
export const NEAR_INTEL_MAX_TOKENS = 3_500;
export const NEAR_INTEL_TIMEOUT_MS = 60_000;
export const NEAR_RELATIVES_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=near,bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true";

export const NEAR_NOTE_SYSTEM_PROMPT = `You are the market intelligence analyst responsible for a significant
investment in NEAR Protocol ($NEAR).

Your task is NOT to produce crypto commentary.

Your task is to determine what has materially changed during the last
6 hours and whether the evidence supports increasing, maintaining,
reducing, or exiting exposure to NEAR.

Use current data only. Include timestamps for important metrics.
Compare every important metric with:
1. 6 hours ago
2. 24 hours ago
3. 7 days ago where relevant.

Never invent unavailable data. Explicitly state "unavailable" instead.

==========================
1. PRICE AND RELATIVE STRENGTH
==========================

Check:

NEAR/USD
NEAR/BTC
NEAR/ETH
NEAR/SOL

Report:

- price change 6h / 24h / 7d
- spot volume
- volume relative to recent average
- major support/resistance
- whether current move is impulsive, consolidating, or breaking down
- whether NEAR is outperforming BTC and major altcoins

Most importantly answer:

Is NEAR rising because the whole crypto market is rising,
or is capital specifically rotating INTO NEAR?

==========================
2. SPOT FLOW
==========================

Investigate:

- CEX spot buying/selling
- Binance / Coinbase / Bybit / OKX if available
- exchange inflows/outflows
- large market buys/sells
- order-book imbalance
- unusual volume

Determine whether the price move is:

SPOT-LED
DERIVATIVES-LED
or MIXED.

A spot-led rally is generally more sustainable than a highly
leveraged derivatives-led rally.

==========================
3. DERIVATIVES / LEVERAGE
==========================

Check:

- total NEAR open interest
- OI change 6h / 24h
- funding rates
- long/short imbalance
- liquidations
- futures basis
- major liquidation clusters

Answer:

Is leverage building faster than price?

Classify derivatives positioning:

HEALTHY
ELEVATED
OVERHEATED
DELEVERAGING

Specifically warn me if:

price ↑ + OI ↑↑ + funding ↑↑

because this can indicate a fragile leveraged rally.

Conversely identify:

price ↑ + spot volume ↑ + moderate OI

as potentially healthier accumulation.

==========================
4. NEAR INTENTS
==========================

This is one of the highest-priority metrics.

Check the official NEAR Intents explorer and reliable analytics.

Report:

- 24h volume
- 7d volume
- 30d volume
- transaction count
- fees/revenue
- TVL where relevant
- buyback activity
- largest integrations/referrals
- unusual cross-chain flows
- new integrations

Compare growth with the previous observation.

Determine:

Is Intents usage actually accelerating,
or is the market merely trading the narrative?

==========================
5. ON-CHAIN NEAR FUNDAMENTALS
==========================

Check:

- transactions
- active addresses/users
- new addresses
- fees
- protocol revenue
- stablecoin supply
- stablecoin inflows/outflows
- bridge flows
- staking percentage
- unstaking activity
- validator changes if meaningful

Highlight divergences such as:

PRICE ↑
ON-CHAIN ACTIVITY ↓

or

PRICE flat
ON-CHAIN ACTIVITY ↑↑

The latter may be particularly interesting.

==========================
6. NEAR ECOSYSTEM CAPITAL FLOWS
==========================

Inspect major NEAR ecosystem assets and protocols.

At minimum consider:

RHEA
Aurora
NEAR Intents
major DeFi protocols
new ecosystem tokens

Check:

- TVL
- DEX volume
- token performance
- stablecoin flows
- liquidity
- protocol fees/revenue

Determine whether capital is moving:

BTC → NEAR
NEAR → NEAR ecosystem
NEAR ecosystem → NEAR
NEAR ecosystem → stablecoins
NEAR → other L1s

Pay special attention to whether NEAR ecosystem tokens are
outperforming NEAR itself.

==========================
7. WHALES / SMART MONEY
==========================

Look for:

- large NEAR transfers
- whale accumulation/distribution
- transfers onto exchanges
- withdrawals from exchanges
- large staking/unstaking events
- known institutional wallets where reliable attribution exists

Do NOT classify an exchange internal wallet movement as a whale trade
without evidence.

Rank significant flows by confidence.

==========================
8. NEWS AND CATALYSTS
==========================

Search the last 6 hours for:

- NEAR Foundation announcements
- NEAR Protocol releases
- Intents developments
- integrations
- exchange listings
- institutional announcements
- partnerships
- governance
- developer releases
- tokenized asset/RWA integrations
- AI/agent developments
- major ecosystem announcements

Distinguish:

CONFIRMED PRIMARY SOURCE
REPUTABLE MEDIA REPORT
RUMOR / SOCIAL MEDIA

Do not give rumor equal weight to confirmed information.

==========================
9. SECURITY / INCIDENTS
==========================

Check:

- exploits
- bridge incidents
- validator problems
- chain outages
- Intents incidents
- ecosystem hacks
- smart-contract exploits

Estimate whether each incident creates:

NEAR TOKEN RISK
ECOSYSTEM REPUTATIONAL RISK
LIQUIDITY RISK
NO MATERIAL TOKEN IMPACT

==========================
10. BTC / MACRO REGIME
==========================

NEAR does not trade independently of the market.

Check:

BTC
ETH
BTC dominance
TOTAL3 / altcoin market
DXY
US Treasury yields
Nasdaq
major Fed/macroeconomic developments
geopolitical shocks if relevant

Determine market regime:

RISK-ON
NEUTRAL
RISK-OFF

And determine whether this environment favors high-beta altcoins
like NEAR.

==========================
11. NARRATIVE / ATTENTION
==========================

Measure whether NEAR attention is:

ACCELERATING
STABLE
FADING

Look at:

- search/social attention
- news frequency
- developer/ecosystem discussion
- volume in related tokens

Do not use social sentiment alone as a trading signal.

Try to identify the dominant NEAR narrative:

AI
Intents
chain abstraction
privacy
DeFi
RWA
institutional adoption
or something new.

==========================
12. CONTRARIAN CHECK
==========================

Actively try to DISPROVE the bullish thesis.

Give me:

The 3 strongest arguments for NEAR going higher.

The 3 strongest arguments for NEAR falling.

Identify any data that contradicts the current market narrative.

This section is mandatory.

==========================
13. MARKET ASSESSMENT
==========================

Produce scores from 0-100:

Price momentum:
Spot demand:
Derivatives health:
On-chain fundamentals:
NEAR Intents:
Ecosystem flows:
Whale activity:
Catalysts/news:
Macro environment:
Risk/reward:

Then calculate:

NEAR BULLISH SCORE: XX/100

Classify:

80-100 STRONG BULLISH
65-79 BULLISH
50-64 NEUTRAL / POSITIVE
40-49 NEUTRAL / NEGATIVE
25-39 BEARISH
0-24 STRONG BEARISH

==========================
14. PROBABILITIES
==========================

Estimate:

Next 6 hours:
UP __%
SIDEWAYS __%
DOWN __%

Next 24 hours:
UP __%
SIDEWAYS __%
DOWN __%

Next 7 days:
UP __%
SIDEWAYS __%
DOWN __%

Also estimate probability NEAR outperforms BTC over:

24h
7d

Explain the assumptions behind the probabilities.

==========================
15. ACTIONABLE CONCLUSION
==========================

Choose ONLY ONE:

STRONG BUY
BUY
HOLD / LET WINNERS RUN
REDUCE
EXIT / HEDGE

Explain why in maximum 5 sentences.

Then state:

WHAT WOULD MAKE YOU MORE BULLISH?

WHAT WOULD MAKE YOU MORE BEARISH?

WHAT SINGLE METRIC SHOULD I WATCH MOST CLOSELY
DURING THE NEXT 6 HOURS?

Finally:

List the 5 most important changes since the previous report,
ranked by importance.

If nothing important changed, explicitly say:

"NO MATERIAL CHANGE IN THESIS."

Do not manufacture a new narrative simply because six hours have passed.

Desk output rules:
- Plain text for Telegram. No markdown tables.
- Keep every numbered section. Be concise. Prefer bullets.
- Payload numbers and timestamps are ground truth.
- If the payload marks a metric unavailable, write unavailable. Do not invent it.`;

export type NearNoteStatus = "attached" | "skipped" | "failed";

export type NearNoteResult = {
  note: string | null;
  status: NearNoteStatus;
  reason?: "no-key" | "empty" | "error";
};

export type NearNotePreviousWindow = {
  at: string;
  quote: string;
  headlines: string[];
  report: string;
};

export type NearRelatives = {
  asOf: string;
  nearUsd: number | null;
  nearVol24h: number | null;
  btcUsd: number | null;
  ethUsd: number | null;
  solUsd: number | null;
  nearChange24h: number | null;
  btcChange24h: number | null;
  ethChange24h: number | null;
  solChange24h: number | null;
  nearBtc: number | null;
  nearEth: number | null;
  nearSol: number | null;
};

type Cache = {
  previous: NearNotePreviousWindow;
};

let cache: Cache | null = null;

export function resetNearNoteCache(): void {
  cache = null;
}

export function pickNearNoteHeadlines(headlines: NearHeadline[], now: Date): NearHeadline[] {
  const cutoff = now.getTime() - NEAR_NOTE_LOOKBACK_MS;
  const recent = headlines.filter((row) => {
    const at = Date.parse(row.publishedAt);
    return Number.isFinite(at) && at >= cutoff;
  });
  return (recent.length > 0 ? recent : headlines).slice(0, NEAR_NOTE_HEADLINE_LIMIT);
}

function formatQuoteLine(quote: NearQuote | null): string {
  if (!quote) {
    return "n/a";
  }
  const change = quote.changePct == null || !Number.isFinite(quote.changePct) ? "n/a" : `${quote.changePct}%`;
  return `${quote.value} USD  ${change} 24h  source=${quote.source}  as_of=${quote.asOf}`;
}

function formatNum(value: number | null | undefined, digits = 6): string {
  if (value == null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return String(Number(value.toFixed(digits)));
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "unavailable";
  }
  return `${value.toFixed(2)}%`;
}

function ratio(left: number | null, right: number | null): number | null {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return null;
  }
  return left / right;
}

function coinUsd(raw: unknown, id: string): { usd: number | null; change: number | null; vol: number | null } {
  const row = raw && typeof raw === "object" ? (raw as Record<string, { usd?: unknown; usd_24h_change?: unknown; usd_24h_vol?: unknown }>)[id] : undefined;
  const usd = Number(row?.usd);
  const change = Number(row?.usd_24h_change);
  const vol = Number(row?.usd_24h_vol);
  return {
    usd: Number.isFinite(usd) && usd > 0 ? usd : null,
    change: Number.isFinite(change) ? Number(change.toFixed(2)) : null,
    vol: Number.isFinite(vol) && vol > 0 ? vol : null,
  };
}

export function parseNearRelatives(raw: unknown, asOf = new Date()): NearRelatives {
  const near = coinUsd(raw, "near");
  const btc = coinUsd(raw, "bitcoin");
  const eth = coinUsd(raw, "ethereum");
  const sol = coinUsd(raw, "solana");
  return {
    asOf: asOf.toISOString(),
    nearUsd: near.usd,
    nearVol24h: near.vol,
    btcUsd: btc.usd,
    ethUsd: eth.usd,
    solUsd: sol.usd,
    nearChange24h: near.change,
    btcChange24h: btc.change,
    ethChange24h: eth.change,
    solChange24h: sol.change,
    nearBtc: ratio(near.usd, btc.usd),
    nearEth: ratio(near.usd, eth.usd),
    nearSol: ratio(near.usd, sol.usd),
  };
}

export async function loadNearRelatives(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  url?: string;
  apiKey?: string;
}): Promise<NearRelatives | null> {
  const now = opts?.now ?? new Date();
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "signal-desk/0.0.1",
  };
  const apiKey = opts?.apiKey ?? process.env.COINGECKO_API_KEY ?? "";
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }
  try {
    const response = await fetchImpl(opts?.url ?? NEAR_RELATIVES_URL, {
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return null;
    }
    return parseNearRelatives(await response.json(), now);
  } catch {
    return null;
  }
}

function changeSince(current: number | null | undefined, previous: number | null | undefined): string {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return "unavailable";
  }
  return `${(((current - previous) / previous) * 100).toFixed(2)}%`;
}

export function buildNearNoteUser(input: {
  now: Date;
  quote: NearQuote | null;
  position: NearPosition;
  headlines: NearHeadline[];
  athUsd?: number | null;
  relatives?: NearRelatives | null;
  previous?: NearNotePreviousWindow | null;
}): string {
  const mark = input.quote ? simulateNearHoldingsUsd(input.position.tokens, input.quote.value) : null;
  const prevPx = input.previous?.quote.match(/^([\d.]+) USD/)?.[1];
  const prevValue = prevPx ? Number(prevPx) : null;
  const hoursSincePrev =
    input.previous && Number.isFinite(Date.parse(input.previous.at))
      ? ((input.now.getTime() - Date.parse(input.previous.at)) / 3_600_000).toFixed(1)
      : "unavailable";
  const lines = [
    `as_of: ${formatDeskClock(input.now)} (${input.now.toISOString()})`,
    `window: last 6h`,
    `quote: ${formatQuoteLine(input.quote)}`,
    `near_usd_change_6h: ${changeSince(input.quote?.value, prevValue)}  (vs previous window ${hoursSincePrev}h ago)`,
    `near_usd_change_24h: ${input.quote?.changePct == null ? "unavailable" : `${input.quote.changePct}%`}`,
    `near_usd_change_7d: unavailable`,
    `holdings: ${input.position.tokens} NEAR`,
    `mark_usd: ${mark ?? "unavailable"}`,
    `book_net_usd: ${input.position.value}`,
    `ath_usd: ${input.athUsd ?? "unavailable"}`,
  ];
  if (input.relatives) {
    lines.push(`relatives_as_of: ${input.relatives.asOf}`);
    lines.push(`NEAR/BTC: ${formatNum(input.relatives.nearBtc, 8)}`);
    lines.push(`NEAR/ETH: ${formatNum(input.relatives.nearEth, 8)}`);
    lines.push(`NEAR/SOL: ${formatNum(input.relatives.nearSol, 6)}`);
    lines.push(`BTC_USD: ${formatNum(input.relatives.btcUsd, 2)}  24h ${formatPct(input.relatives.btcChange24h)}`);
    lines.push(`ETH_USD: ${formatNum(input.relatives.ethUsd, 2)}  24h ${formatPct(input.relatives.ethChange24h)}`);
    lines.push(`SOL_USD: ${formatNum(input.relatives.solUsd, 2)}  24h ${formatPct(input.relatives.solChange24h)}`);
    lines.push(`NEAR_spot_volume_24h_usd: ${formatNum(input.relatives.nearVol24h, 0)}`);
  } else {
    lines.push("relatives: unavailable");
  }
  lines.push("headlines (max 12, last 6h if possible):");
  if (input.headlines.length === 0) {
    lines.push("- none");
  } else {
    for (const row of input.headlines) {
      lines.push(`- ${row.tone} ${row.sourceName}  ${row.title}  ${formatDeskClock(new Date(row.publishedAt))}  ${row.publishedAt}`);
    }
  }
  if (input.previous) {
    lines.push(`previous_window_at: ${input.previous.at}`);
    lines.push(`previous_window_quote: ${input.previous.quote}`);
    lines.push(`previous_window_headlines: ${input.previous.headlines.join(" ") || "none"}`);
    lines.push("previous_report:");
    lines.push(input.previous.report);
  } else {
    lines.push("previous_window: unavailable (first report this process)");
  }
  lines.push("desk_coverage_have: NEAR/USD live, 24h %, optional 6h vs last report, BTC/ETH/SOL 24h and NEAR crosses if relatives loaded, holdings, mark, book net, ATH, last 6h headlines, previous report if any");
  lines.push(
    "desk_coverage_unavailable: 7d NEAR path, volume vs average, support/resistance, CEX spot flow, order book, exchange inflows, OI, funding, liquidations, basis, Intents volume/TVL/fees, on-chain actives/fees/stables/bridges, ecosystem TVL, whale labels, DXY, yields, Nasdaq, social attention",
  );
  return lines.join("\n");
}

export async function loadNearNote(input: {
  now: Date;
  quote: NearQuote | null;
  position: NearPosition;
  headlines: NearHeadline[];
  athUsd?: number | null;
  relatives?: NearRelatives | null;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  complete?: typeof completeChat;
}): Promise<NearNoteResult> {
  const apiKey = input.apiKey ?? "";
  if (!apiKey) {
    return { note: null, status: "skipped", reason: "no-key" };
  }
  const headlines = pickNearNoteHeadlines(input.headlines, input.now);
  const user = buildNearNoteUser({
    now: input.now,
    quote: input.quote,
    position: input.position,
    headlines,
    athUsd: input.athUsd,
    relatives: input.relatives,
    previous: cache?.previous ?? null,
  });
  try {
    const complete = input.complete ?? completeChat;
    const raw = await complete({
      baseUrl: input.baseUrl ?? "https://api.openai.com/v1",
      apiKey,
      model: input.model ?? "gpt-4o-mini",
      system: NEAR_NOTE_SYSTEM_PROMPT,
      user,
      timeoutMs: NEAR_INTEL_TIMEOUT_MS,
      maxTokens: NEAR_INTEL_MAX_TOKENS,
    });
    const note = sanitizeNearNote(raw);
    if (!note) {
      return { note: null, status: "failed", reason: "empty" };
    }
    cache = {
      previous: {
        at: input.now.toISOString(),
        quote: formatQuoteLine(input.quote),
        headlines: headlines.map((row) => row.url),
        report: note,
      },
    };
    return { note, status: "attached" };
  } catch {
    return { note: null, status: "failed", reason: "error" };
  }
}

export function sanitizeNearNote(raw: string): string | null {
  const lines = raw
    .split("\n")
    .map((line) => line.trimEnd())
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, NEAR_NOTE_MAX_LINES);
  if (lines.length === 0) {
    return null;
  }
  const text = lines.join("\n");
  return text.length > NEAR_NOTE_MAX_CHARS ? text.slice(0, NEAR_NOTE_MAX_CHARS) : text;
}
