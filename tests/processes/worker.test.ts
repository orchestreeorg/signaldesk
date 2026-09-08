import { afterEach, describe, expect, it } from "vitest";
import { clearCollectors } from "../../src/collectors/registry.js";
import { startWorker } from "../../src/processes/worker.js";

const canBoot = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!canBoot)("worker process", () => {
  afterEach(() => {
    clearCollectors();
  });

  it("boots with the no-op collector and the named queues", async () => {
    const runtime = await startWorker();
    expect(runtime.collectors).toEqual(["noop", "tape", "news"]);
    expect([...runtime.queues]).toEqual([
      "tape",
      "news",
      "features",
      "classify",
      "outcomes",
      "digest",
    ]);
    expect(runtime.schedulers).toEqual(["digest-utc", "news-poll", "tape-oi"]);
    await runtime.stop();
  });
});
