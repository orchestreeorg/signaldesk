"use client";

import { useEffect, useState } from "react";
import { dashHeaders, writeDashSecret } from "@/lib/client-auth";
import { AppShell } from "@/lib/nav";

type ToneMode = "loose" | "balanced" | "strict";
type HeadlineSend = "all" | "skip_neutral" | "directional_only";

type DeskSettings = {
  headlineEnabled: boolean;
  toneMode: ToneMode;
  headlineSend: HeadlineSend;
  bullishTerms: string[];
  bearishTerms: string[];
  flashEnabled: boolean;
  fadeEnabled: boolean;
  highNovelty: number;
  highCredibility: number;
  fadeCredibility: number;
  loudNarrative: number;
  flashDailyCap: number;
  newsBatchLimit: number;
};

type SourceDraft = {
  id: string;
  name: string;
  url: string;
  rank: number;
  kind: "rss" | "atom" | "html" | "esplora";
  enabled: boolean;
};

type PreviewRow = { title: string; tone: string; send: boolean };

const emptySource = (): SourceDraft => ({
  id: "",
  name: "",
  url: "",
  rank: 70,
  kind: "rss",
  enabled: true,
});

export default function ParametersPage() {
  const [settings, setSettings] = useState<DeskSettings | null>(null);
  const [sources, setSources] = useState<SourceDraft[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [secretDraft, setSecretDraft] = useState("");

  const load = async () => {
    setNotice("");
    try {
      const response = await fetch("/api/parameters", { headers: dashHeaders() });
      const json = (await response.json()) as { settings?: DeskSettings; sources?: SourceDraft[]; error?: string };
      if (response.status === 401 || json.error === "unauthorized") {
        setLocked(true);
        setNotice("Enter DASH_SECRET (Vercel env) to unlock Parameters.");
        return;
      }
      if (json.error) {
        setNotice(json.error);
        return;
      }
      setLocked(false);
      if (json.settings) {
        setSettings(json.settings);
      }
      if (json.sources) {
        setSources(json.sources);
      }
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!settings) {
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        const response = await fetch("/api/parameters/preview", {
          method: "POST",
          headers: dashHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ settings }),
        });
        const json = (await response.json()) as { preview?: PreviewRow[]; error?: string };
        if (json.preview) {
          setPreview(json.preview);
        }
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [settings]);

  const save = async () => {
    if (!settings) {
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/parameters", {
        method: "PUT",
        headers: dashHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ settings, sources }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        sourcesError?: string;
        settings?: DeskSettings;
        sources?: SourceDraft[];
      };
      if (json.settings) {
        setSettings(json.settings);
      }
      if (json.sources && !json.sourcesError) {
        setSources(json.sources);
      }
      if (response.status === 401 || json.error === "unauthorized") {
        setLocked(true);
        setNotice("Enter DASH_SECRET (Vercel env) to unlock Parameters.");
        return;
      }
      if (json.error && !json.ok) {
        setNotice(json.error);
        return;
      }
      if (json.ok && json.sourcesError) {
        setNotice(`Settings saved. Sources not updated: ${json.sourcesError}`);
        return;
      }
      setNotice(json.ok ? "Saved. Next news job uses these values (no worker restart)." : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const patch = (partial: Partial<DeskSettings>) =>
    setSettings((current) => (current ? { ...current, ...partial } : current));

  if (locked || !settings) {
    return (
    <AppShell current="parameters" title="Parameters" subtitle="This page is gated by DASH_SECRET on Vercel.">
        {locked ? (
          <section className="card stack">
            <label>
              DASH_SECRET
              <input
                type="password"
                value={secretDraft}
                onChange={(event) => setSecretDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    writeDashSecret(secretDraft);
                    void load();
                  }
                }}
              />
            </label>
            <div className="controls">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  writeDashSecret(secretDraft);
                  void load();
                }}
              >
                Unlock
              </button>
            </div>
          </section>
        ) : null}
        <p className="note">{notice || "Loading parameters…"}</p>
    </AppShell>
    );
  }

  return (
    <AppShell
      current="parameters"
      title="Parameters"
      subtitle="Sources, headline tone, and FLASH/FADE gates. Secrets stay in .env. This is not a trading UI."
    >
      <section className="card stack">
        <h2>News sources</h2>
        <div className="table-wrap">
        <table className="params">
          <thead>
            <tr>
              <th>On</th>
              <th>Id</th>
              <th>Name</th>
              <th>URL</th>
              <th>Rank</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, index) => (
              <tr key={`${source.id}-${index}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(event) =>
                      setSources((rows) => rows.map((row, i) => (i === index ? { ...row, enabled: event.target.checked } : row)))
                    }
                  />
                </td>
                <td>
                  <input
                    value={source.id}
                    onChange={(event) =>
                      setSources((rows) => rows.map((row, i) => (i === index ? { ...row, id: event.target.value } : row)))
                    }
                  />
                </td>
                <td>
                  <input
                    value={source.name}
                    onChange={(event) =>
                      setSources((rows) => rows.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                    }
                  />
                </td>
                <td>
                  <input
                    value={source.url}
                    onChange={(event) =>
                      setSources((rows) => rows.map((row, i) => (i === index ? { ...row, url: event.target.value } : row)))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={source.rank}
                    onChange={(event) =>
                      setSources((rows) =>
                        rows.map((row, i) => (i === index ? { ...row, rank: Number(event.target.value) } : row)),
                      )
                    }
                  />
                </td>
                <td>
                  <select
                    value={source.kind}
                    onChange={(event) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, kind: event.target.value as SourceDraft["kind"] } : row,
                        ),
                      )
                    }
                  >
                    <option value="rss">rss</option>
                    <option value="atom">atom</option>
                    <option value="html">html</option>
                    <option value="esplora">esplora</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="controls">
          <button type="button" onClick={() => setSources((rows) => [...rows, emptySource()])}>
            Add source
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Headlines &amp; tone</h2>
        <p className="help">Loose = more pings; strict = fewer.</p>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.headlineEnabled}
            onChange={(event) => patch({ headlineEnabled: event.target.checked })}
          />
          Send headline pings
        </label>
        <label>
          Tone mode
          <select value={settings.toneMode} onChange={(event) => patch({ toneMode: event.target.value as ToneMode })}>
            <option value="loose">loose</option>
            <option value="balanced">balanced</option>
            <option value="strict">strict</option>
          </select>
        </label>
        <label>
          Headline send
          <select
            value={settings.headlineSend}
            onChange={(event) => patch({ headlineSend: event.target.value as HeadlineSend })}
          >
            <option value="all">all</option>
            <option value="skip_neutral">skip_neutral</option>
            <option value="directional_only">directional_only</option>
          </select>
        </label>
        <div className="split">
          <label>
            Bullish terms (one per line)
            <textarea
              value={settings.bullishTerms.join("\n")}
              onChange={(event) =>
                patch({ bullishTerms: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })
              }
            />
          </label>
          <label>
            Bearish terms (one per line)
            <textarea
              value={settings.bearishTerms.join("\n")}
              onChange={(event) =>
                patch({ bearishTerms: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })
              }
            />
          </label>
        </div>
        <div className="preview">
          {preview.length === 0 ? (
            <div>Preview loading…</div>
          ) : (
            preview.map((row) => (
              <div key={row.title}>
                <b>{row.tone}</b> · {row.send ? "send" : "skip"} · {row.title}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card stack">
        <h2>Fusion (FLASH / FADE)</h2>
        <p className="help">
          CoinDesk ~0.56 cred today; FLASH at 0.7 rarely fires. Lower high credibility to get more FLASH.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.flashEnabled}
            onChange={(event) => patch({ flashEnabled: event.target.checked })}
          />
          FLASH enabled
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.fadeEnabled}
            onChange={(event) => patch({ fadeEnabled: event.target.checked })}
          />
          FADE enabled
        </label>
        <label>
          High novelty {settings.highNovelty.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.highNovelty}
            onChange={(event) => patch({ highNovelty: Number(event.target.value) })}
          />
        </label>
        <label>
          High credibility {settings.highCredibility.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.highCredibility}
            onChange={(event) => patch({ highCredibility: Number(event.target.value) })}
          />
        </label>
        <label>
          FADE credibility {settings.fadeCredibility.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.fadeCredibility}
            onChange={(event) => patch({ fadeCredibility: Number(event.target.value) })}
          />
        </label>
        <label>
          Loud narrative {settings.loudNarrative.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.loudNarrative}
            onChange={(event) => patch({ loudNarrative: Number(event.target.value) })}
          />
        </label>
        <label>
          FLASH daily cap
          <input
            type="number"
            min={0}
            max={100}
            value={settings.flashDailyCap}
            onChange={(event) => patch({ flashDailyCap: Number(event.target.value) })}
          />
        </label>
        <label>
          News batch limit
          <input
            type="number"
            min={1}
            max={100}
            value={settings.newsBatchLimit}
            onChange={(event) => patch({ newsBatchLimit: Number(event.target.value) })}
          />
        </label>
      </section>

      <div className="controls">
        <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="note">{notice}</p>
    </AppShell>
  );
}
