import type { Collector } from "./types.js";

export const noopCollector: Collector = {
  name: "noop",
  async run() {
    // Placeholder so the worker can boot before tape/news exist.
  },
};
