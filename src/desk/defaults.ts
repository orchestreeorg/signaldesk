import type { DeskSettings, NewsSourceRow } from "./types.js";

export const BALANCED_BULLISH_TERMS = [
  "inflow",
  "approval",
  "approved",
  "listing",
  "lists",
  "rate cut",
  "cuts rates",
  "all-time high",
];

export const BALANCED_BEARISH_TERMS = [
  "hack",
  "exploit",
  "drained",
  "breach",
  "outflow",
  "lawsuit",
  "sues",
  "enforcement",
  "insolvency",
  "unlock",
  "cliff",
  "ban",
  "rejected",
];

export const LOOSE_BULLISH_EXTRA = ["rally", "surge", "ath", "etf approved", "etf"];
export const LOOSE_BEARISH_EXTRA = ["dump", "crash", "halt", "sued"];

export const STRICT_STRONG_BULLISH = ["inflow", "approval", "approved"];
export const STRICT_STRONG_BEARISH = ["hack", "exploit", "outflow", "lawsuit", "insolvency"];

export const DEFAULT_DESK_SETTINGS: DeskSettings = {
  headlineEnabled: true,
  toneMode: "balanced",
  headlineSend: "all",
  bullishTerms: [...BALANCED_BULLISH_TERMS],
  bearishTerms: [...BALANCED_BEARISH_TERMS],
  flashEnabled: true,
  fadeEnabled: true,
  highNovelty: 0.8,
  highCredibility: 0.7,
  fadeCredibility: 0.5,
  loudNarrative: 0.4,
  flashDailyCap: 4,
  newsBatchLimit: 12,
};

export const SEED_NEWS_SOURCES: NewsSourceRow[] = [
  {
    id: "coindesk",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    rank: 70,
    kind: "rss",
    enabled: true,
  },
  {
    id: "theblock",
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    rank: 75,
    kind: "rss",
    enabled: true,
  },
  {
    id: "fed",
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    rank: 95,
    kind: "rss",
    enabled: true,
  },
  {
    id: "edgar",
    name: "SEC EDGAR",
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom",
    rank: 90,
    kind: "atom",
    enabled: true,
  },
  {
    id: "farside",
    name: "Farside BTC ETF",
    url: "https://farside.co.uk/btc/",
    rank: 80,
    kind: "html",
    enabled: true,
  },
  {
    id: "mempool",
    name: "mempool.space",
    url: "https://mempool.space/api",
    rank: 70,
    kind: "esplora",
    enabled: true,
  },
];

export const SAMPLE_HEADLINE_TITLES = [
  "Major venue pauses withdrawals",
  "Spot ETF posts record inflow",
  "SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)",
  "ETF inflow after exchange hack",
  "Exchange hack drains hot wallet",
];
