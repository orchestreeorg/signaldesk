export const NEWS_SOURCE_KINDS = ["rss", "atom", "html", "esplora"] as const;
export type NewsSourceKind = (typeof NEWS_SOURCE_KINDS)[number];

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  rank: number;
  kind: NewsSourceKind;
};

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "coindesk",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    rank: 70,
    kind: "rss",
  },
  {
    id: "theblock",
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    rank: 75,
    kind: "rss",
  },
  {
    id: "fed",
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    rank: 95,
    kind: "rss",
  },
  {
    id: "edgar",
    name: "SEC EDGAR",
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom",
    rank: 90,
    kind: "atom",
  },
  {
    id: "farside",
    name: "Farside BTC ETF",
    url: "https://farside.co.uk/btc/",
    rank: 80,
    kind: "html",
  },
  {
    id: "mempool",
    name: "mempool.space",
    url: "https://mempool.space/api",
    rank: 70,
    kind: "esplora",
  },
];

export function sourceById(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((source) => source.id === id);
}
