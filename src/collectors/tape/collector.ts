import type { Collector } from "../types.js";
import type { TapeRuntime } from "./runtime.js";

export function createTapeCollector(opts?: { live?: boolean; runtime?: TapeRuntime }): Collector {
  return {
    name: "tape",
    async run() {
      if (!opts?.live) {
        return;
      }
      await opts.runtime?.pollOi();
    },
  };
}
