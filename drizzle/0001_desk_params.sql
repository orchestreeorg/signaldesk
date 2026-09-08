CREATE TABLE IF NOT EXISTS news_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  rank integer NOT NULL CHECK (rank >= 0 AND rank <= 100),
  kind text NOT NULL CHECK (kind IN ('rss', 'atom', 'html')),
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS desk_settings (
  id integer PRIMARY KEY,
  headline_enabled boolean NOT NULL DEFAULT true,
  tone_mode text NOT NULL DEFAULT 'balanced' CHECK (tone_mode IN ('loose', 'balanced', 'strict')),
  headline_send text NOT NULL DEFAULT 'all' CHECK (headline_send IN ('all', 'skip_neutral', 'directional_only')),
  bullish_terms text[] NOT NULL DEFAULT '{}',
  bearish_terms text[] NOT NULL DEFAULT '{}',
  flash_enabled boolean NOT NULL DEFAULT true,
  fade_enabled boolean NOT NULL DEFAULT true,
  high_novelty double precision NOT NULL DEFAULT 0.8,
  high_credibility double precision NOT NULL DEFAULT 0.7,
  fade_credibility double precision NOT NULL DEFAULT 0.5,
  loud_narrative double precision NOT NULL DEFAULT 0.4,
  flash_daily_cap integer NOT NULL DEFAULT 4,
  news_batch_limit integer NOT NULL DEFAULT 12,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO news_sources (id, name, url, rank, kind, enabled) VALUES
  ('coindesk', 'CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 70, 'rss', true),
  ('theblock', 'The Block', 'https://www.theblock.co/rss.xml', 75, 'rss', true),
  ('fed', 'Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml', 95, 'rss', true),
  ('edgar', 'SEC EDGAR', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom', 90, 'atom', true),
  ('farside', 'Farside BTC ETF', 'https://farside.co.uk/btc/', 80, 'html', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO desk_settings (
  id, headline_enabled, tone_mode, headline_send, bullish_terms, bearish_terms,
  flash_enabled, fade_enabled, high_novelty, high_credibility, fade_credibility,
  loud_narrative, flash_daily_cap, news_batch_limit
) VALUES (
  1, true, 'balanced', 'all',
  ARRAY['inflow','approval','approved','listing','lists','rate cut','cuts rates','all-time high'],
  ARRAY['hack','exploit','drained','breach','outflow','lawsuit','sues','enforcement','insolvency','unlock','cliff','ban','rejected'],
  true, true, 0.8, 0.7, 0.5, 0.4, 4, 12
) ON CONFLICT (id) DO NOTHING;
