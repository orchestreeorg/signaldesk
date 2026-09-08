import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { startLiveTape, type SocketLike } from "../../../src/collectors/tape/live.js";
import { TapeRuntime } from "../../../src/collectors/tape/runtime.js";
import { combinedStreamUrl, parseStreamEnvelope } from "../../../src/collectors/tape/stream.js";
import { fetchOpenInterest } from "../../../src/collectors/tape/oi.js";

const here = dirname(fileURLToPath(import.meta.url));
const agg = JSON.parse(readFileSync(join(here, "../../fixtures/tape/aggTrade.json"), "utf8"));

describe("live tape", () => {
  it("builds the combined Binance futures URL", () => {
    const url = combinedStreamUrl();
    expect(url).toContain("btcusdt@aggTrade");
    expect(url).toContain("ethusdt@markPrice@1s");
    expect(url).toContain("forceOrder");
  });

  it("unwraps combined-stream envelopes", () => {
    const tick = parseStreamEnvelope(JSON.stringify({ stream: "btcusdt@aggTrade", data: agg }));
    expect(tick?.asset).toBe("BTC");
    expect(tick?.cvdDelta).toBe(0.25);
  });

  it("accumulates CVD for feature snapshots", async () => {
    const tape = new TapeRuntime(undefined, async () => []);
    const tick = parseStreamEnvelope(JSON.stringify({ data: agg }));
    if (!tick) {
      throw new Error("missing tick");
    }
    tape.ingest(tick);
    tape.ingest({ ...tick, cvdDelta: 0.1, ts: new Date(tick.ts.getTime() + 1) });
    const snapshot = await tape.snapshotFor("BTC", tick.ts);
    expect(snapshot.cvd).toBeCloseTo(0.35);
  });

  it("fetches OI through an injected client", async () => {
    const ticks = await fetchOpenInterest(async (url) => {
      const symbol = String(url).includes("ETH") ? "ETHUSDT" : "BTCUSDT";
      return {
        ok: true,
        async json() {
          return { symbol, openInterest: "12.5", time: 1725700800000 };
        },
      } as Response;
    });
    expect(ticks.map((tick) => tick.asset).sort()).toEqual(["BTC", "ETH"]);
  });

  it("reconnects after the socket closes", async () => {
    vi.useFakeTimers();
    const sockets: SocketLike[] = [];
    const live = startLiveTape({
      fetchOi: async () => [],
      pollOiMs: 60_000,
      connect: () => {
        const socket: SocketLike = {
          onmessage: null,
          onclose: null,
          onerror: null,
          close() {},
        };
        sockets.push(socket);
        return socket;
      },
    });
    expect(sockets).toHaveLength(1);
    sockets[0]?.onclose?.({});
    await vi.advanceTimersByTimeAsync(500);
    expect(sockets).toHaveLength(2);
    live.stop();
    vi.useRealTimers();
  });
});
