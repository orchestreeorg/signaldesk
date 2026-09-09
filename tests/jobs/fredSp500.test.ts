import { afterEach, describe, expect, it } from "vitest";
import { FRED_SP500_TTL_MS, loadFredSp500, parseFredSp500, resetFredSp500Cache } from "../../src/jobs/fredSp500.js";

afterEach(() => {
  resetFredSp500Cache();
});

describe("parseFredSp500", () => {
  it("takes the latest numeric close and day change", () => {
    expect(
      parseFredSp500({
        observations: [
          { date: "2026-09-08", value: "." },
          { date: "2026-09-05", value: "6500.25" },
          { date: "2026-09-04", value: "6450.00" },
        ],
      }),
    ).toMatchObject({
      source: "fred",
      seriesId: "SP500",
      value: 6500.25,
      changePct: 0.78,
      asOf: "2026-09-05T00:00:00.000Z",
    });
  });

  it("returns null when every value is missing", () => {
    expect(parseFredSp500({ observations: [{ date: "2026-09-08", value: "." }] })).toBeNull();
    expect(parseFredSp500({})).toBeNull();
  });
});

describe("loadFredSp500", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          observations: [
            { date: "2026-09-05", value: "6500.25" },
            { date: "2026-09-04", value: "6450.00" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadFredSp500({ fetchImpl, apiKey: "test-key", now: new Date(t0) });
    const second = await loadFredSp500({
      fetchImpl,
      apiKey: "test-key",
      now: new Date(t0 + FRED_SP500_TTL_MS - 1),
    });
    expect(first?.value).toBe(6500.25);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null without a key and does not fetch", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("nope", { status: 200 });
    };
    await expect(loadFredSp500({ fetchImpl, apiKey: "", now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
    expect(calls).toBe(0);
  });
});
