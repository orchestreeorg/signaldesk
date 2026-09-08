import type { RawItem } from "../collectors/news/types.js";
import type { LlmClient } from "./llm.js";
import type { LlmExtract } from "./types.js";

function assetsOf(text: string): string[] {
  const upper = text.toUpperCase();
  const assets: string[] = [];
  if (upper.includes("ETH") || upper.includes("ETHEREUM")) {
    assets.push("ETH");
  }
  if (upper.includes("BTC") || upper.includes("BITCOIN")) {
    assets.push("BTC");
  }
  return assets;
}

export function heuristicExtract(item: RawItem): LlmExtract {
  const text = `${item.title} ${item.body}`;
  const lower = text.toLowerCase();
  const assets = assetsOf(text);
  const summary = item.title.slice(0, 280);

  if (item.sourceId === "farside" || /\betf\b/.test(lower)) {
    const polarity = /outflow/.test(lower) ? -0.7 : 0.7;
    return { class: "ETF_INFLOW", assets: assets.length ? assets : ["BTC"], polarity, summary };
  }
  if (/withdrawal/.test(lower) && /pause|halt|outage/.test(lower)) {
    return { class: "EXCHANGE_STRESS", assets: assets.length ? assets : ["BTC"], polarity: -0.9, summary };
  }
  if (/(hack|exploit|drained|breach)/.test(lower) && /(exchange|binance|coinbase|okx|bybit|kraken|venue)/.test(lower)) {
    return { class: "HACK_VENUE", assets: assets.length ? assets : ["BTC"], polarity: -0.9, summary };
  }
  if (/(hack|exploit|drained)/.test(lower)) {
    return { class: "HACK_PROTOCOL", assets: assets.length ? assets : ["ETH"], polarity: -0.85, summary };
  }
  if (item.sourceId === "edgar" || /\bsec\b|enforcement|lawsuit|sues/.test(lower)) {
    return { class: "ENFORCEMENT", assets: assets.length ? assets : ["BTC"], polarity: -0.5, summary };
  }
  if (/rate cut|cuts rates/.test(lower)) {
    return { class: "RATE_CUT", assets: assets.length ? assets : ["BTC"], polarity: 0.6, summary };
  }
  if (item.sourceId === "fed" || /fomc|macro surprise|cpi |nfp /.test(lower)) {
    return { class: "MACRO_SURPRISE", assets: assets.length ? assets : ["BTC"], polarity: 0, summary };
  }
  if (/unlock|cliff/.test(lower)) {
    return { class: "UNLOCK", assets: assets.length ? assets : ["ETH"], polarity: -0.3, summary };
  }
  if (/lists |listing/.test(lower)) {
    return { class: "LISTING", assets: assets.length ? assets : ["BTC"], polarity: 0.4, summary };
  }
  return { class: "OTHER", assets, polarity: 0, summary };
}

export function heuristicLlm(): LlmClient {
  return {
    async extract(item) {
      return heuristicExtract(item);
    },
  };
}
