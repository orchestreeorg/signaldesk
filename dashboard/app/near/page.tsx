"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, StatusChip } from "@/lib/nav";
import type { OpsHeartbeat } from "@/lib/types";
import { formatDeskClock, formatDeskStamp } from "@/lib/tz";
import { NearPriceSimulator } from "./NearPriceSimulator";

type Tone = "BULLISH" | "BEARISH" | "NEUTRAL";
type ToneTab = "ALL" | Tone;
type Side = "entry" | "exit";

type Headline = {
  title: string;
  url: string;
  href: string | null;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  tone: Tone;
};

type Lot = {
  id: string;
  side: Side;
  at: string;
  tokens: number;
  value: number;
};

type NearQuote = {
  source: "coingecko" | "yahoo";
  symbol: "NEAR";
  value: number;
  changePct: number | null;
  asOf: string;
};

type NearPayload = {
  now: string;
  quote: NearQuote | null;
  position: { tokens: number; value: number; entries: number; exits: number };
  lots: Lot[];
  headlines: Headline[];
  error?: string;
};

type Status = {
  online?: boolean;
  heartbeat?: OpsHeartbeat | null;
  error?: string;
};

const TABS: ToneTab[] = ["ALL", "BULLISH", "BEARISH", "NEUTRAL"];

function localInputValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatNear(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatUsd(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  return n < 0 ? `−${abs.replace("$", "$")}` : abs;
}

function formatPx(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) {
    return "n/a";
  }
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) {
    return `+${abs}%`;
  }
  if (n < 0) {
    return `−${abs}%`;
  }
  return `${abs}%`;
}

function signedClass(score: number | null | undefined): string {
  if (score == null || score === 0) {
    return "";
  }
  return score > 0 ? "metric-up" : "metric-down";
}

export default function NearPage() {
  const [data, setData] = useState<NearPayload | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<ToneTab>("ALL");
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState<Side>("entry");
  const [at, setAt] = useState(localInputValue);
  const [tokens, setTokens] = useState("");
  const [value, setValue] = useState("");

  const load = async () => {
    const [nearRes, statusRes] = await Promise.all([fetch("/api/near"), fetch("/api/status")]);
    const payload = (await nearRes.json()) as NearPayload;
    const nextStatus = (await statusRes.json()) as Status;
    setStatus(nextStatus);
    if (payload.error) {
      setNotice(payload.error);
      return;
    }
    setData(payload);
    setNotice("");
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        await load();
      } catch (error: unknown) {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const headlines = useMemo(() => {
    const rows = data?.headlines ?? [];
    return tab === "ALL" ? rows : rows.filter((row) => row.tone === tab);
  }, [data?.headlines, tab]);

  const online = Boolean(status?.online);
  const paused = Boolean(status?.heartbeat?.paused);
  const position = data?.position;

  const saveLot = async () => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/near/lots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side,
          at: new Date(at).toISOString(),
          tokens: Number(tokens),
          value: Number(value),
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (json.error) {
        setNotice(json.error);
        return;
      }
      setTokens("");
      setValue("");
      setAt(localInputValue());
      await load();
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const removeLot = async (id: string) => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/near/lots?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (json.error) {
        setNotice(json.error);
        return;
      }
      await load();
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      current="near"
      title="NEAR"
      subtitle="Entries, exits, and NEAR headlines. Position chart comes later. Not fusion."
      extra={
        <StatusChip
          online={online}
          paused={paused}
          label={online ? (paused ? "paused" : "worker online") : "worker offline"}
        />
      }
    >
      <>
          <section className="overview-lead">
            <article className="card">
              <h2>Position</h2>
              {!data ? (
                <Spinner label="Loading NEAR position" tall />
              ) : (
                <>
                  <div className="quote-row">
                    <div className="metric">{formatNear(position?.tokens ?? 0)}</div>
                    <div className="meta">NEAR</div>
                  </div>
                  {data.quote ? (
                    <div className="macro-index-head">
                      <strong className={signedClass(data.quote.changePct)}>{formatPx(data.quote.value)}</strong>
                      <span className={`quote-delta ${signedClass(data.quote.changePct)}`}>
                        {formatPct(data.quote.changePct)}
                      </span>
                    </div>
                  ) : (
                    <div className="macro-index-head">
                      <strong>n/a</strong>
                      <span className="meta">live $NEAR</span>
                    </div>
                  )}
                  <div className="macro-index-head">
                    <strong>{formatUsd(position?.value ?? 0)}</strong>
                    <span className="meta">net value</span>
                  </div>
                  <div className="meta">
                    {data.quote
                      ? `${data.quote.source === "coingecko" ? "CoinGecko" : "Yahoo NEAR-USD"} · ${formatDeskClock(data.quote.asOf)}`
                      : "Live $NEAR unavailable"}
                    {` · ${position?.entries ?? 0} entries · ${position?.exits ?? 0} exits`}
                  </div>
                  <NearPriceSimulator tokens={position?.tokens ?? 0} livePrice={data.quote?.value ?? null} />
                </>
              )}
            </article>
            <article className="card stack">
              <h2>Record lot</h2>
              <form
                className="near-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveLot();
                }}
              >
                <label>
                  Side
                  <select value={side} onChange={(event) => setSide(event.target.value as Side)}>
                    <option value="entry">entry</option>
                    <option value="exit">exit</option>
                  </select>
                </label>
                <label>
                  Time
                  <input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} required />
                </label>
                <label>
                  Tokens
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="NEAR"
                    value={tokens}
                    onChange={(event) => setTokens(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Value
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="USD"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                  />
                </label>
                <button className="btn primary wide" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save lot"}
                </button>
              </form>
            </article>
            <article className="card">
              <h2>Lots</h2>
              {!data ? (
                <Spinner label="Loading lots" tall />
              ) : data.lots.length === 0 ? (
                <p className="empty-inline">No entries or exits yet</p>
              ) : (
                <ul className="near-lots">
                  {data.lots.slice(0, 6).map((lot) => (
                    <li key={lot.id}>
                      <span className={`tone tone-${lot.side === "entry" ? "BULLISH" : "BEARISH"}`}>{lot.side}</span>
                      <span>
                        {formatNear(lot.tokens)} · {formatUsd(lot.value)}
                      </span>
                      <span className="ts">{formatDeskStamp(lot.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="overview-metrics">
            <article className="card">
              <h2>Tokens</h2>
              <div className="metric">{data ? formatNear(data.position.tokens) : "—"}</div>
              <div className="meta">Net NEAR held</div>
            </article>
            <article className="card">
              <h2>Value</h2>
              <div className="metric">{data ? formatUsd(data.position.value) : "—"}</div>
              <div className="meta">Net USD in / out</div>
            </article>
            <article className="card">
              <h2>Entries</h2>
              <div className="metric">{data ? data.position.entries : "—"}</div>
              <div className="meta">Lots persisted</div>
            </article>
            <article className="card">
              <h2>Exits</h2>
              <div className="metric">{data ? data.position.exits : "—"}</div>
              <div className="meta">Lots persisted</div>
            </article>
          </section>

          <section className="card stack overview-headlines">
            <h2>NEAR news</h2>
            <div className="tabs">
              {TABS.map((name) => (
                <button key={name} type="button" className={tab === name ? "on" : ""} onClick={() => setTab(name)}>
                  {name}
                </button>
              ))}
            </div>
            {headlines.length === 0 ? (
              !data ? (
                <Spinner label="Loading NEAR news" tall />
              ) : (
                <p className="empty-inline">No NEAR headlines</p>
              )
            ) : (
              <>
                <div className="blotter-head">
                  <span>Side</span>
                  <span>Source</span>
                  <span>Headline</span>
                  <span>Time</span>
                </div>
                <ul className="news-list">
                  {headlines.map((row) => (
                    <li key={`${row.url}-${row.publishedAt}`}>
                      <HeadlineRow row={row} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card stack">
            <h2>All lots</h2>
            {!data || data.lots.length === 0 ? (
              <p className="empty-inline">Save an entry or exit to start the book</p>
            ) : (
              <table className="near-lot-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Time</th>
                    <th>Tokens</th>
                    <th>Value</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.lots.map((lot) => (
                    <tr key={lot.id}>
                      <td>{lot.side}</td>
                      <td>{formatDeskStamp(lot.at)}</td>
                      <td>{formatNear(lot.tokens)}</td>
                      <td>{formatUsd(lot.value)}</td>
                      <td>
                        <button type="button" disabled={busy} onClick={() => void removeLot(lot.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="note">{notice || (data ? `Updated ${formatDeskClock(data.now)}` : "Loading NEAR…")}</p>
      </>
    </AppShell>
  );
}

function Spinner(props: { label: string; tall?: boolean }) {
  return (
    <div className={props.tall ? "spinner-wrap tall" : "spinner-wrap"} role="status" aria-live="polite" aria-label={props.label}>
      <span className="spinner" />
    </div>
  );
}

function HeadlineRow(props: { row: Headline }) {
  const time = formatDeskClock(props.row.publishedAt);
  const title = props.row.href ? (
    <a href={props.row.href} target="_blank" rel="noreferrer">
      {props.row.title}
    </a>
  ) : (
    <span>{props.row.title}</span>
  );
  return (
    <div className="news-row">
      <span className={`tone tone-${props.row.tone}`}>{props.row.tone}</span>
      <span className="source-chip">{props.row.sourceName}</span>
      {title}
      <span className="ts">{time}</span>
    </div>
  );
}
