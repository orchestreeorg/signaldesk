import { afterEach, describe, expect, it } from "vitest";
import { noopCollector } from "../../src/collectors/noop.js";
import {
  clearCollectors,
  listCollectors,
  registerCollector,
  runCollectors,
} from "../../src/collectors/registry.js";

describe("collector registry", () => {
  afterEach(() => {
    clearCollectors();
  });

  it("registers a no-op collector and runs it", async () => {
    registerCollector(noopCollector);
    expect(listCollectors().map((collector) => collector.name)).toEqual(["noop"]);
    await expect(runCollectors({ now: new Date() })).resolves.toBeUndefined();
  });
});
