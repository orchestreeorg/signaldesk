import { describe, expect, it } from "vitest";
import { QUEUE_NAMES } from "../src/queue.js";

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
});
