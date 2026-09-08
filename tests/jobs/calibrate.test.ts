import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Event, FeatureSnapshot } from "../../src/domain/index.js";
import { createPool } from "../../src/db/client.js";
import { migrate } from "../../src/db/migrate.js";
import { fuse } from "../../src/fusion/index.js";
import {
  MIN_CELL_N,
  brierByKind,
  ensurePriorView,
  formatBrierTable,
  loadPriorsFromView,
  priorLookupFromStudy,
  studyPriors,
  type StudySample,
} from "../../src/jobs/calibrate.js";

function sample(
  partial: Pick<StudySample, "class" | "realizedReturn"> & Partial<StudySample>,
): StudySample {
  return {
    volRegime: "high",
    horizon: "1h",
    ...partial,
  };
}

function event(): Event {
  return {
    id: "ev_1",
    class: "ETF_INFLOW",
    assets: ["BTC"],
    source: "farside",
    url: "https://example.com/a",
    fingerprint: "fp-a",
    novelty: 1,
    credibility: 0.85,
    polarity: 0.8,
    occurredAt: new Date("2026-09-07T12:00:00.000Z"),
  };
}

function snapshot(): FeatureSnapshot {
  return {
    ts: new Date("2026-09-07T12:00:00.000Z"),
    asset: "BTC",
    exchangeNetflowZ: null,
    stablecoinDeltaZ: null,
    funding: null,
    oiChangePct: null,
    cvd: 6,
    volRegime: "mid",
  };
}

describe("calibrate", () => {
  it("uses the cell once N≥20", () => {
    const rows: StudySample[] = [
      ...Array.from({ length: 16 }, () =>
        sample({ class: "HACK_VENUE", realizedReturn: -0.03 }),
      ),
      ...Array.from({ length: 2 }, () =>
        sample({ class: "HACK_VENUE", realizedReturn: 0.03 }),
      ),
      ...Array.from({ length: 2 }, () =>
        sample({ class: "HACK_VENUE", realizedReturn: 0 }),
      ),
    ];
    expect(rows).toHaveLength(MIN_CELL_N);
    const cell = studyPriors(rows).find(
      (row) => row.class === "HACK_VENUE" && row.volRegime === "high" && row.horizon === "1h",
    );
    expect(cell?.source).toBe("empirical");
    expect(cell?.n).toBe(20);
    expect(cell?.pDown).toBeCloseTo(0.8, 3);
    expect(cell?.pUp).toBeCloseTo(0.1, 3);
    expect(cell?.pIn).toBeCloseTo(0.1, 3);
    expect((cell?.pUp ?? 0) + (cell?.pDown ?? 0) + (cell?.pIn ?? 0)).toBeCloseTo(1, 3);
  });

  it("shrinks to the global prior when N<20", () => {
    const rows: StudySample[] = [
      ...Array.from({ length: 16 }, () =>
        sample({ class: "HACK_VENUE", realizedReturn: -0.03 }),
      ),
      ...Array.from({ length: 2 }, () =>
        sample({ class: "HACK_VENUE", realizedReturn: 0.03 }),
      ),
      ...Array.from({ length: 1 }, () =>
        sample({ class: "HACK_VENUE", realizedReturn: 0 }),
      ),
      ...Array.from({ length: 5 }, () =>
        sample({ class: "ETF_INFLOW", volRegime: "mid", horizon: "24h", realizedReturn: 0.04 }),
      ),
    ];
    const priors = studyPriors(rows);
    const thin = priors.find(
      (row) => row.class === "ETF_INFLOW" && row.volRegime === "mid" && row.horizon === "24h",
    );
    expect(thin?.n).toBe(5);
    expect(thin?.source).toBe("global");
    expect(thin?.pUp).toBeCloseTo(7 / 24, 3);
    expect(thin?.pDown).toBeCloseTo(16 / 24, 3);
    expect(thin?.pIn).toBeCloseTo(1 / 24, 3);
  });

  it("prints Brier by alert kind", () => {
    const rows = brierByKind([
      {
        kind: "FLASH",
        horizon: "24h",
        pUp: 1,
        pDown: 0,
        pIn: 0,
        realizedReturn: 0.05,
      },
      {
        kind: "FLASH",
        horizon: "24h",
        pUp: 1,
        pDown: 0,
        pIn: 0,
        realizedReturn: -0.05,
      },
      {
        kind: "FADE",
        horizon: "24h",
        pUp: 0,
        pDown: 0,
        pIn: 1,
        realizedReturn: 0.01,
      },
    ]);
    const flash = rows.find((row) => row.kind === "FLASH");
    const fade = rows.find((row) => row.kind === "FADE");
    expect(flash?.n).toBe(2);
    expect(flash?.brier).toBeCloseTo(1, 5);
    expect(fade?.brier).toBeCloseTo(0, 5);
    const table = formatBrierTable(rows);
    expect(table).toContain("FLASH");
    expect(table).toContain("FADE");
    expect(table).toContain("1.0000");
  });

  it("lets fusion read the study instead of the class fallback", () => {
    const priors = studyPriors(
      Array.from({ length: 20 }, () =>
        sample({
          class: "ETF_INFLOW",
          volRegime: "mid",
          horizon: "24h",
          realizedReturn: -0.04,
        }),
      ),
    );
    const fallback = fuse({ event: event(), snapshot: snapshot() });
    const studied = fuse({
      event: event(),
      snapshot: snapshot(),
      priors: priorLookupFromStudy(priors),
    });
    expect(fallback[0]?.kind).toBe("FLASH");
    expect(studied[0]?.kind).toBe("FLASH");
    expect(studied[0]?.pDown).toBeGreaterThan(studied[0]?.pUp ?? 1);
    expect(studied[0]?.pDown).toBeGreaterThan(fallback[0]?.pDown ?? 0);
  });
});

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("event_study_priors view", () => {
  const pool = createPool(databaseUrl ?? "");

  beforeAll(async () => {
    await migrate(databaseUrl ?? "");
    await ensurePriorView(async (sql) => pool.query(sql));
  });

  afterAll(async () => {
    await pool.end();
  });

  it("exposes a full class×regime×horizon grid that shrinks when empty", async () => {
    const rows = await loadPriorsFromView(async (sql) => pool.query(sql));
    expect(rows).toHaveLength(10 * 3 * 4);
    expect(rows.every((row) => row.source === "global")).toBe(true);
    expect(rows.every((row) => row.n === 0)).toBe(true);
    expect(rows[0] ? rows[0].pUp + rows[0].pDown + rows[0].pIn : 0).toBeCloseTo(1, 3);
  });
});
