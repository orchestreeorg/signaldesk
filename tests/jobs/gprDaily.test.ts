import { afterEach, describe, expect, it } from "vitest";
import xlsx from "xlsx";
import {
  GPR_DAILY_TTL_MS,
  classifyGpr,
  gprBar,
  loadGprDaily,
  parseGprDailyObservations,
  parseGprDailyRows,
  parseGprDailyWorkbook,
  resetGprDailyCache,
} from "../../src/jobs/gprDaily.js";

afterEach(() => {
  resetGprDailyCache();
});

function gprWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const sheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseGprDailyRows", () => {
  it("takes the latest GPRD by DAY", () => {
    const parsed = parseGprDailyRows([
      { DAY: "20260907", GPRD: 144.86 },
      { DAY: "20260908", GPRD: 83.65069580078125 },
    ]);
    expect(parsed).toMatchObject({
      source: "iacoviello",
      value: 83.65,
      classification: "Normal",
      asOf: "2026-09-08T00:00:00.000Z",
    });
    expect(parsed?.stress).toBeCloseTo((83.65069580078125 / 250) * 100);
  });

  it("returns null when GPRD is missing", () => {
    expect(parseGprDailyRows([{ DAY: "20260908", GPRD: "." }])).toBeNull();
    expect(parseGprDailyRows([])).toBeNull();
  });

  it("exposes each valid daily observation", () => {
    const rows = parseGprDailyObservations([
      { DAY: "20260907", GPRD: 144.86 },
      { DAY: "20260908", GPRD: 83.65 },
    ]);
    expect(rows.map((row) => row.value)).toEqual([144.86, 83.65]);
    expect(rows[1]?.asOf).toBe("2026-09-08T00:00:00.000Z");
  });
});

describe("classifyGpr", () => {
  it("buckets daily geopolitical risk around the long-run average of 100", () => {
    expect(classifyGpr(70)).toBe("Calm");
    expect(classifyGpr(100)).toBe("Normal");
    expect(classifyGpr(150)).toBe("Elevated");
    expect(classifyGpr(220)).toBe("High");
  });
});

describe("gprBar", () => {
  it("caps stress at 250 GPR", () => {
    expect(gprBar(250)).toEqual({ stress: 100, calm: 0 });
    expect(gprBar(125)).toEqual({ stress: 50, calm: 50 });
  });
});

describe("loadGprDaily", () => {
  it("parses a workbook and does not refetch inside the TTL", async () => {
    const body = gprWorkbook([
      { DAY: "20260907", GPRD: 144.86 },
      { DAY: "20260908", GPRD: 83.65 },
    ]);
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(body as unknown as BodyInit, { status: 200 });
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadGprDaily({ fetchImpl, now: new Date(t0) });
    const second = await loadGprDaily({ fetchImpl, now: new Date(t0 + GPR_DAILY_TTL_MS - 1) });
    expect(parseGprDailyWorkbook(body)?.value).toBe(83.65);
    expect(first?.value).toBe(83.65);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null on HTTP errors without throwing", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 404 });
    await expect(loadGprDaily({ fetchImpl, now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
  });
});
