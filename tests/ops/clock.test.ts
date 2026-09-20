import { describe, expect, it } from "vitest";
import { formatWait, nextDigestAt, nextMacroAt, nextNearAt, nextNewsAt, nextTapeAt } from "../../src/ops/clock.js";
import { formatDeskClock, formatDeskStamp } from "../../src/ops/tz.js";

describe("ops clock", () => {
  it("aligns news to the next 5-minute slot", () => {
    const now = new Date("2026-09-08T22:02:10.000Z");
    expect(nextNewsAt(now).toISOString()).toBe("2026-09-08T22:05:00.000Z");
  });

  it("aligns tape to the next minute", () => {
    const now = new Date("2026-09-08T22:02:10.000Z");
    expect(nextTapeAt(now).toISOString()).toBe("2026-09-08T22:03:00.000Z");
  });

  it("picks the next DIGEST hour in Argentina time", () => {
    expect(nextDigestAt(new Date("2026-09-08T07:00:00.000Z")).toISOString()).toBe("2026-09-08T11:00:00.000Z");
    expect(nextDigestAt(new Date("2026-09-08T16:00:01.000Z")).toISOString()).toBe("2026-09-08T19:00:00.000Z");
    expect(nextDigestAt(new Date("2026-09-08T19:00:01.000Z")).toISOString()).toBe("2026-09-09T03:00:00.000Z");
  });

  it("aligns the weekly index to the next hour", () => {
    expect(nextMacroAt(new Date("2026-09-08T22:02:10.000Z")).toISOString()).toBe("2026-09-08T23:00:00.000Z");
    expect(nextMacroAt(new Date("2026-09-08T23:00:00.000Z")).toISOString()).toBe("2026-09-09T00:00:00.000Z");
    expect(nextNearAt(new Date("2026-09-08T22:02:10.000Z")).toISOString()).toBe("2026-09-08T23:00:00.000Z");
  });

  it("formats a wait line in ART", () => {
    const now = new Date("2026-09-17T14:25:43.000Z");
    const next = new Date("2026-09-17T15:00:00.000Z");
    expect(formatWait(next, now)).toBe("34m 17s until 2026-09-17 12:00 ART");
  });
});

describe("desk timezone", () => {
  it("formats Argentina civil time from UTC", () => {
    const noonUtc = new Date("2026-09-17T15:00:00.000Z");
    expect(formatDeskClock(noonUtc)).toBe("12:00 ART");
    expect(formatDeskStamp(noonUtc)).toBe("2026-09-17 12:00 ART");
  });
});
