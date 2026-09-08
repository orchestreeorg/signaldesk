import type { Collector } from "../types.js";
import { pollNews, type FetchXml } from "./poll.js";
import type { RawItem } from "./types.js";

export function createNewsCollector(opts?: {
  live?: boolean;
  fetchXml?: FetchXml;
  persist?: (items: RawItem[]) => Promise<void>;
}): Collector {
  return {
    name: "news",
    async run() {
      if (!opts?.live) {
        return;
      }
      const items = await pollNews({ fetchXml: opts.fetchXml });
      if (opts.persist) {
        await opts.persist(items);
      }
    },
  };
}
