import { afterEach, describe, expect, it } from "vitest";
import {
  FRED_OVX_TTL_MS,
  classifyOvx,
  fredOvxUrl,
  loadFredOvx,
  ovxBar,
  parseFredOvx,
  parseFredOvxObservations,
  resetFredOvxCache,
} from "../../src/jobs/fredOvx.js";

afterEach(() => {
  resetFredOvxCache();
});

describe("parseFredOvx", () => {
  it("takes the latest numeric OVX observation", () => {
    const parsed = parseFredOvx({
      observations: [
        { date: "2026-09-08", value: "." },
        { date: "2026-09-05", value: "32.14" },
      ],
    });
    expect(parsed).toMatchObject({
      source: "fred",
      seriesId: "OVXCLS",
      value: 32.14,
      classification: "Normal",
      asOf: "2026-09-05T00:00:00.000Z",
    });
    expect(parsed?.stress).toBeCloseTo((32.14 / 80) * 100);
    expect(parsed?.calm).toBeCloseTo(100 - (32.14 / 80) * 100);
  });

  it("returns null when every value is missing", () => {
    expect(parseFredOvx({ observations: [{ date: "2026-09-08", value: "." }] })).toBeNull();
    expect(parseFredOvx({})).toBeNull();
  });

  it("exposes valid history and requests 60 observations", () => {
    expect(
      parseFredOvxObservations({
        observations: [
          { date: "2026-09-05", value: "32.14" },
          { date: "2026-09-04", value: "." },
          { date: "2026-09-03", value: "30" },
        ],
      }),
    ).toHaveLength(2);
    expect(new URL(fredOvxUrl("key")).searchParams.get("limit")).toBe("60");
  });
});

describe("classifyOvx", () => {
  it("buckets oil implied vol", () => {
    expect(classifyOvx(18)).toBe("Calm");
    expect(classifyOvx(32)).toBe("Normal");
    expect(classifyOvx(48)).toBe("Elevated");
    expect(classifyOvx(70)).toBe("High");
  });
});

describe("ovxBar", () => {
  it("caps stress at 80 OVX", () => {
    expect(ovxBar(80)).toEqual({ stress: 100, calm: 0 });
    expect(ovxBar(40)).toEqual({ stress: 50, calm: 50 });
  });
});

describe("loadFredOvx", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ observations: [{ date: "2026-09-05", value: "28.5" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadFredOvx({ fetchImpl, apiKey: "test-key", now: new Date(t0) });
    const second = await loadFredOvx({ fetchImpl, apiKey: "test-key", now: new Date(t0 + FRED_OVX_TTL_MS - 1) });
    expect(first?.value).toBe(28.5);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null without a key and does not fetch", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("nope", { status: 200 });
    };
    await expect(loadFredOvx({ fetchImpl, apiKey: "", now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
    expect(calls).toBe(0);
  });

  it("returns null on HTTP errors without throwing", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 400 });
    await expect(
      loadFredOvx({ fetchImpl, apiKey: "test-key", now: new Date("2026-09-09T12:00:00.000Z") }),
    ).resolves.toBeNull();
  });
});
