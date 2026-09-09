"use client";

import { useEffect, useMemo, useState } from "react";
import { dashHeaders } from "@/lib/client-auth";
import { AppShell, StatusChip } from "@/lib/nav";
import type { OpsHeartbeat } from "@/lib/types";

type Tone = "BULLISH" | "BEARISH" | "NEUTRAL";
type ToneTab = "ALL" | Tone;

type Headline = {
  title: string;
  url: string;
  href: string | null;
  sourceId: string;
  publishedAt: string;
  tone: Tone;
};

type LargeBtc = Headline & { btc: number | null };

type OverviewPayload = {
  now: string;
  mix: { bull: number; bear: number; neutral: number; score: number | null };
  mixLabel: string;
  calls: { FLASH: number; FADE: number; CONFIRM: number; INVALIDATE: number };
  lastCall: {
    kind: "FLASH" | "FADE";
    asset: string;
    why: string;
    realizedText: string;
  } | null;
  largeBtc: LargeBtc[];
  headlines: Headline[];
  classified: { class: string; n: number }[] | null;
  marks: { BTC?: number; ETH?: number } | null;
  error?: string;
};

type Status = {
  online?: boolean;
  heartbeat?: OpsHeartbeat | null;
  error?: string;
};

const TABS: ToneTab[] = ["ALL", "BULLISH", "BEARISH", "NEUTRAL"];

export default function OverviewPage() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState("");
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<ToneTab>("ALL");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [overviewRes, statusRes] = await Promise.all([
          fetch("/api/overview", { headers: dashHeaders() }),
          fetch("/api/status"),
        ]);
        const payload = (await overviewRes.json()) as OverviewPayload;
        const nextStatus = (await statusRes.json()) as Status;
        if (cancelled) {
          return;
        }
        setStatus(nextStatus);
        if (overviewRes.status === 401) {
          setLocked(true);
          setNotice("Enter DASH_SECRET on Parameters to unlock Overview.");
          return;
        }
        setLocked(false);
        if (payload.error) {
          setNotice(payload.error);
          return;
        }
        setData(payload);
        setNotice("");
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
    const filtered = tab === "ALL" ? rows : rows.filter((row) => row.tone === tab);
    return filtered.slice(0, 40);
  }, [data?.headlines, tab]);

  const callTotal =
    (data?.calls.FLASH ?? 0) +
    (data?.calls.FADE ?? 0) +
    (data?.calls.CONFIRM ?? 0) +
    (data?.calls.INVALIDATE ?? 0);
  const online = Boolean(status?.online);
  const paused = Boolean(status?.heartbeat?.paused);
  const mixTotal = data ? data.mix.bull + data.mix.bear + data.mix.neutral : 0;

  return (
    <AppShell
      current="overview"
      title="Overview"
      subtitle="Last 24 hours of processed headlines, mempool prints, and calls. Console is the worker log."
      extra={
        <StatusChip
          online={online}
          paused={paused}
          label={online ? (paused ? "paused" : "worker online") : "worker offline"}
        />
      }
    >
      {locked ? (
        <p className="note">{notice}</p>
      ) : (
        <>
          <section className="overview-split">
            <article className="card large-btc-card">
              <h2>Large BTC</h2>
              {!data ? (
                <Spinner label="Loading large BTC" tall />
              ) : data.largeBtc.length ? (
                <>
                  <div className="metric">{formatBtc(data.largeBtc.reduce((sum, row) => sum + (row.btc ?? 0), 0))}</div>
                  <div className="meta">{data.largeBtc.length} mempool prints · last 24h</div>
                  <BtcBars rows={data.largeBtc} />
                </>
              ) : (
                <p className="empty-inline">No large BTC prints</p>
              )}
            </article>

            <article className="card overview-combined">
              <section>
                <h2>News mix</h2>
                {!data ? (
                  <Spinner label="Loading news mix" />
                ) : (
                  <>
                    <div className="metric">{data.mix.score === null ? "mix n/a" : data.mixLabel}</div>
                    {mixTotal > 0 ? (
                      <div className="mix-bar" aria-hidden="true">
                        <span className="bull" style={{ width: `${(data.mix.bull / mixTotal) * 100}%` }} />
                        <span className="bear" style={{ width: `${(data.mix.bear / mixTotal) * 100}%` }} />
                        <span className="neutral" style={{ width: `${(data.mix.neutral / mixTotal) * 100}%` }} />
                      </div>
                    ) : null}
                    <div className="mix-legend">
                      <span>
                        <b>{data.mix.bull}</b> bull
                      </span>
                      <span>
                        <b>{data.mix.bear}</b> bear
                      </span>
                      <span>
                        <b>{data.mix.neutral}</b> neutral
                      </span>
                    </div>
                  </>
                )}
              </section>
              <section>
                <h2>Calls</h2>
                {!data ? (
                  <Spinner label="Loading calls" />
                ) : callTotal === 0 ? (
                  <>
                    <div className="metric">none</div>
                    <div className="meta">Last: none</div>
                  </>
                ) : (
                  <>
                    <div className="stat-row">
                      <div className="stat">
                        <span>FLASH</span>
                        <strong>{data.calls.FLASH}</strong>
                      </div>
                      <div className="stat">
                        <span>FADE</span>
                        <strong>{data.calls.FADE}</strong>
                      </div>
                      <div className="stat">
                        <span>CONFIRM</span>
                        <strong>{data.calls.CONFIRM}</strong>
                      </div>
                      <div className="stat">
                        <span>INVALIDATE</span>
                        <strong>{data.calls.INVALIDATE}</strong>
                      </div>
                    </div>
                    <div className="meta">
                      {data.lastCall
                        ? `Last: ${data.lastCall.kind} ${data.lastCall.asset} · ${data.lastCall.why} · ${data.lastCall.realizedText}`
                        : "Last: none"}
                    </div>
                  </>
                )}
              </section>
              {!data ? (
                <section>
                  <h2>Classified</h2>
                  <Spinner label="Loading classified" />
                </section>
              ) : data.classified ? (
                <section>
                  <h2>Classified</h2>
                  <div className="mix-legend">
                    {data.classified.map((row) => (
                      <span key={row.class}>
                        <b>{row.n}</b> {row.class}
                      </span>
                    ))}
                  </div>
                  <div className="meta">EventClass from classify · not headline tone</div>
                </section>
              ) : null}
              {data?.marks ? (
                <section>
                  <h2>Last marks</h2>
                  <div className="metric metric-sm">
                    {[
                      data.marks.BTC !== undefined ? `BTC ${data.marks.BTC.toLocaleString()}` : null,
                      data.marks.ETH !== undefined ? `ETH ${data.marks.ETH.toLocaleString()}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="meta">from price_marks · not a live tape</div>
                </section>
              ) : null}
            </article>
          </section>

          <section className="card stack overview-headlines">
            <h2>Headlines</h2>
            <div className="tabs">
              {TABS.map((name) => (
                <button key={name} type="button" className={tab === name ? "on" : ""} onClick={() => setTab(name)}>
                  {name}
                </button>
              ))}
            </div>
            {headlines.length === 0 ? (
              !data ? (
                <Spinner label="Loading headlines" tall />
              ) : (
                <p className="empty-inline">No headlines</p>
              )
            ) : (
              <ul className="news-list">
                {headlines.map((row) => (
                  <li key={`${row.url}-${row.publishedAt}`}>
                    <HeadlineRow row={row} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="note">{notice || (data ? `Updated ${data.now.slice(11, 16)} UTC` : "Loading overview…")}</p>
        </>
      )}
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

function formatBtc(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "—";
  }
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} BTC`;
}

function BtcBars(props: { rows: LargeBtc[] }) {
  const chronological = [...props.rows].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const max = Math.max(1, ...chronological.map((row) => row.btc ?? 0));
  return (
    <div className="btc-chart" role="img" aria-label="Large BTC transfers by amount">
      {chronological.map((row) => {
        const btc = row.btc ?? 0;
        const height = `${Math.max(8, (btc / max) * 100)}%`;
        const label = formatBtc(btc);
        const when = row.publishedAt.slice(11, 16);
        const inner = (
          <>
            <span className="btc-amt">{btc > 0 ? btc.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "—"}</span>
            <span className="btc-track">
              <span className="btc-bar" style={{ height }} />
            </span>
            <span className="btc-when">{when}</span>
          </>
        );
        if (row.href) {
          return (
            <a key={row.url} className="btc-col" href={row.href} target="_blank" rel="noreferrer" title={`${label} at ${when} UTC`}>
              {inner}
            </a>
          );
        }
        return (
          <div key={row.url} className="btc-col" title={`${label} at ${when} UTC`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function HeadlineRow(props: { row: Headline }) {
  const time = props.row.publishedAt.slice(11, 16);
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
      <span className="source-chip">{props.row.sourceId}</span>
      {title}
      <span className="ts">{time} UTC</span>
    </div>
  );
}
