import { describe, expect, it } from "vitest";
import { DIGEST_CRON, DIGEST_HOURS, MACRO_CRON, NEAR_CRON, NEWS_CRON, TAPE_CRON, dummyAlert } from "../../src/jobs/schedule.js";
import { DESK_TZ } from "../../src/ops/tz.js";

describe("digest schedule", () => {
  it("registers 00:00, 08:00, and 16:00 ART", () => {
    expect([...DIGEST_HOURS]).toEqual([0, 8, 16]);
    expect(DIGEST_CRON).toBe("0 0,8,16 * * *");
    expect(NEWS_CRON).toBe("*/5 * * * *");
    expect(TAPE_CRON).toBe("* * * * *");
    expect(MACRO_CRON).toBe("0 * * * *");
    expect(NEAR_CRON).toBe("0 * * * *");
    expect(DESK_TZ).toBe("America/Argentina/Buenos_Aires");
  });

  it("builds the two smoke kinds only", () => {
    expect(dummyAlert("FLASH").kind).toBe("FLASH");
    expect(dummyAlert("DIGEST").kind).toBe("DIGEST");
    expect(dummyAlert("FLASH").pUp + dummyAlert("FLASH").pDown + dummyAlert("FLASH").pIn).toBeCloseTo(
      1,
      3,
    );
  });
});
