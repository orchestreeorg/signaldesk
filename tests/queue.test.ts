import { describe, expect, it } from "vitest";
import { QUEUE_NAMES, WORKER_LOCK_DURATION_MS, WORKER_STALLED_INTERVAL_MS } from "../src/queue.js";

describe("queues", () => {
  it("declares the six job queues and does not invent others", () => {
    expect([...QUEUE_NAMES]).toEqual([
      "tape",
      "news",
      "features",
      "classify",
      "outcomes",
      "digest",
    ]);
  });

  it("keeps worker locks longer than the default 30s news poll", () => {
    expect(WORKER_LOCK_DURATION_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(WORKER_STALLED_INTERVAL_MS).toBeGreaterThanOrEqual(60 * 1000);
  });
});
