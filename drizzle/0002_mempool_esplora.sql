DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'news_sources'
      AND con.conname = 'news_sources_kind_check'
      AND pg_get_constraintdef(con.oid) ILIKE '%esplora%'
  ) THEN
    ALTER TABLE news_sources DROP CONSTRAINT IF EXISTS news_sources_kind_check;
    ALTER TABLE news_sources ADD CONSTRAINT news_sources_kind_check
      CHECK (kind IN ('rss', 'atom', 'html', 'esplora'));
  END IF;
END $$;

INSERT INTO news_sources (id, name, url, rank, kind, enabled) VALUES
  ('mempool', 'mempool.space', 'https://mempool.space/api', 70, 'esplora', true)
ON CONFLICT (id) DO NOTHING;
