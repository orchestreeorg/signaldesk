import type { Collector } from "../types.js";
import type { FetchJson } from "./parseMempool.js";
import { pollNews, type FetchXml } from "./poll.js";
import type { RawItem } from "./types.js";

export function createNewsCollector(opts?: {
  live?: boolean;
  fetchXml?: FetchXml;
  fetchJson?: FetchJson;
  persist?: (items: RawItem[]) => Promise<void>;
}): Collector {
  return {
    name: "news",
    async run() {
      if (!opts?.live) {
        return;
      }
      const items = await pollNews({ fetchXml: opts.fetchXml, fetchJson: opts.fetchJson });
      if (opts.persist) {
        await opts.persist(items);
      }
    },
  };
}
