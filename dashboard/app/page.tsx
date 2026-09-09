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
  largeBtc: Headline[];
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
          <section className="overview-grid">
            <article className="card">
              <h2>News mix</h2>
              <div className="metric">{data ? (data.mix.score === null ? "mix n/a" : data.mixLabel) : "…"}</div>
              {data && mixTotal > 0 ? (
                <div className="mix-bar" aria-hidden="true">
                  <span className="bull" style={{ width: `${(data.mix.bull / mixTotal) * 100}%` }} />
                  <span className="bear" style={{ width: `${(data.mix.bear / mixTotal) * 100}%` }} />
                  <span className="neutral" style={{ width: `${(data.mix.neutral / mixTotal) * 100}%` }} />
                </div>
              ) : null}
              <div className="mix-legend">
                {data ? (
                  <>
                    <span>
                      <b>{data.mix.bull}</b> bull
                    </span>
                    <span>
                      <b>{data.mix.bear}</b> bear
                    </span>
                    <span>
                      <b>{data.mix.neutral}</b> neutral
                    </span>
                  </>
                ) : (
                  <span>loading</span>
                )}
              </div>
            </article>
            <article className="card">
              <h2>Calls</h2>
              {!data || callTotal === 0 ? (
                <div className="metric">none</div>
              ) : (
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
              )}
              <div className="meta">
                {data?.lastCall
                  ? `Last: ${data.lastCall.kind} ${data.lastCall.asset} · ${data.lastCall.why} · ${data.lastCall.realizedText}`
                  : "Last: none"}
              </div>
            </article>
            {data?.marks ? (
              <article className="card">
                <h2>Last marks</h2>
                <div className="metric">
                  {[
                    data.marks.BTC !== undefined ? `BTC ${data.marks.BTC.toLocaleString()}` : null,
                    data.marks.ETH !== undefined ? `ETH ${data.marks.ETH.toLocaleString()}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="meta">from price_marks · not a live tape</div>
              </article>
            ) : null}
            {data?.classified ? (
              <article className="card">
                <h2>Classified</h2>
                <div className="mix-legend">
                  {data.classified.map((row) => (
                    <span key={row.class}>
                      <b>{row.n}</b> {row.class}
                    </span>
                  ))}
                </div>
                <div className="meta">EventClass from classify · not headline tone</div>
              </article>
            ) : null}
          </section>

          <section className="card stack">
            <h2>Large BTC</h2>
            {data?.largeBtc.length ? (
              <ul className="news-list">
                {data.largeBtc.map((row) => (
                  <li key={row.url}>
                    <HeadlineRow row={row} hideTone />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-inline">No large BTC prints</p>
            )}
          </section>

          <section className="card stack">
            <h2>Headlines</h2>
            <div className="tabs">
              {TABS.map((name) => (
                <button key={name} type="button" className={tab === name ? "on" : ""} onClick={() => setTab(name)}>
                  {name}
                </button>
              ))}
            </div>
            {headlines.length === 0 ? (
              <p className="empty-inline">No headlines</p>
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

function HeadlineRow(props: { row: Headline; hideTone?: boolean }) {
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
      {props.hideTone ? <span className="tone tone-NEUTRAL">MEMPOOL</span> : <span className={`tone tone-${props.row.tone}`}>{props.row.tone}</span>}
      <span className="source-chip">{props.row.sourceId}</span>
      {title}
      <span className="ts">{time} UTC</span>
    </div>
  );
}
