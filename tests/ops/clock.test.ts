import { describe, expect, it } from "vitest";
import { formatWait, nextDigestAt, nextNewsAt, nextTapeAt } from "../../src/ops/clock.js";

describe("ops clock", () => {
  it("aligns news to the next 5-minute UTC slot", () => {
    const now = new Date("2026-09-08T22:02:10.000Z");
    expect(nextNewsAt(now).toISOString()).toBe("2026-09-08T22:05:00.000Z");
  });

  it("aligns tape to the next minute", () => {
    const now = new Date("2026-09-08T22:02:10.000Z");
    expect(nextTapeAt(now).toISOString()).toBe("2026-09-08T22:03:00.000Z");
  });

  it("picks the next DIGEST hour", () => {
    expect(nextDigestAt(new Date("2026-09-08T07:00:00.000Z")).toISOString()).toBe("2026-09-08T08:00:00.000Z");
    expect(nextDigestAt(new Date("2026-09-08T16:00:01.000Z")).toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });

  it("formats a wait line", () => {
    const now = new Date("2026-09-08T22:02:00.000Z");
    const next = new Date("2026-09-08T22:05:00.000Z");
    expect(formatWait(next, now)).toContain("3m 00s until");
  });
});
