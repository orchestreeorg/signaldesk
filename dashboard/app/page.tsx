"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dashHeaders } from "@/lib/client-auth";
import type { OpsEvent, OpsHeartbeat } from "@/lib/types";

type Status = {
  online: boolean;
  heartbeat: OpsHeartbeat | null;
  spawnable: boolean;
  vercel: boolean;
  error?: string;
};

export default function Page() {
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const after = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [statusRes, logRes] = await Promise.all([fetch("/api/status"), fetch(`/api/logs?after=${after.current}`)]);
        const nextStatus = (await statusRes.json()) as Status;
        const nextLogs = (await logRes.json()) as { events: OpsEvent[] };
        if (cancelled) {
          return;
        }
        setStatus(nextStatus);
        if (nextLogs.events?.length) {
          after.current = nextLogs.events[nextLogs.events.length - 1]?.seq ?? after.current;
          setEvents((prev) => [...prev, ...nextLogs.events].slice(-400));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [events.length]);

  const heartbeat = status?.heartbeat ?? null;
  const online = Boolean(status?.online);

  const action = async (name: string) => {
    setBusy(name);
    setNotice("");
    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: dashHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ action: name }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      setNotice(json.error ?? json.message ?? "");
    } finally {
      setBusy(null);
    }
  };

  const hint = useMemo(() => {
    if (status?.vercel && !online) {
      return "Vercel can only watch logs. Start the worker on a host that uses the same REDIS_URL (`pnpm worker`).";
    }
    if (!online) {
      return "Worker offline. Start it here (local) or run `pnpm worker` in a terminal.";
    }
    if (heartbeat?.paused) {
      return "Worker is paused. Jobs will log that they are skipped until you resume.";
    }
    return "Worker is live. Waiting lines mean the next cron has not fired yet.";
  }, [heartbeat?.paused, online, status?.vercel]);

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>signal-desk ops</h1>
          <p className="sub">
            Transparent worker console. Every fetch, skip, hold, send, and idle wait is logged.
            This is not a trading UI.
          </p>
        </div>
        <div className="top-actions">
          <a className="badge" href="/parameters">Parameters</a>
          <div className={`badge ${online ? "on" : ""}`}>
            <span className={`dot ${online ? (heartbeat?.paused ? "pause" : "on") : ""}`} />
            {online ? (heartbeat?.paused ? "paused" : `online pid ${heartbeat?.pid}`) : "offline"}
          </div>
        </div>
      </header>

      <section className="grid">
        <WaitCard title="News poll" wait={heartbeat?.waiting.news} at={heartbeat?.nextNewsAt} live={heartbeat?.newsLive} />
        <WaitCard title="Tape OI" wait={heartbeat?.waiting.tape} at={heartbeat?.nextTapeAt} live={heartbeat?.tapeLive} />
        <WaitCard title="DIGEST" wait={heartbeat?.waiting.digest} at={heartbeat?.nextDigestAt} live={heartbeat ? !heartbeat.dryRun : undefined} extra="00:00 / 08:00 / 16:00 UTC" />
      </section>

      <div className="controls">
        <button className="primary" disabled={Boolean(busy) || (online && !heartbeat?.paused)} onClick={() => void action("start")}>
          Start worker
        </button>
        <button disabled={Boolean(busy) || !online} onClick={() => void action("pause")}>Pause</button>
        <button disabled={Boolean(busy) || !online} onClick={() => void action("resume")}>Resume</button>
        <button disabled={Boolean(busy) || !online} onClick={() => void action("run-news")}>Run news now</button>
        <button disabled={Boolean(busy) || !online} onClick={() => void action("run-tape")}>Run tape OI now</button>
        <button disabled={Boolean(busy) || !online} onClick={() => void action("run-digest")}>Send digest now</button>
        <button className="danger" disabled={Boolean(busy) || !online} onClick={() => void action("stop")}>Stop</button>
      </div>
      <p className="note">{busy ? `Working: ${busy}` : notice || hint}</p>

      <div className="logbox" ref={scroller}>
        {events.length === 0 ? (
          <div className="empty">No ops events yet. Start the worker and keep this tab open.</div>
        ) : (
          events.map((event) => (
            <div className="row" key={`${event.seq}-${event.ts}`}>
              <span className="ts">{event.ts.slice(11, 23)}</span>
              <span className={`lvl lvl-${event.level}`}>{event.level}</span>
              <span className="scope">{event.scope}</span>
              <span>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function WaitCard(props: { title: string; wait?: string; at?: string; live?: boolean; extra?: string }) {
  return (
    <article className="card">
      <h2>{props.title}</h2>
      <div className="wait">{props.wait ?? "waiting for heartbeat…"}</div>
      <div className="meta">
        {props.live === undefined ? "" : props.live ? "live on" : "live off"}
        {props.at ? ` · next ${props.at}` : ""}
        {props.extra ? ` · ${props.extra}` : ""}
      </div>
    </article>
  );
}
