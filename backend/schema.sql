CREATE TABLE IF NOT EXISTS articles (
 id TEXT PRIMARY KEY,
 author TEXT NOT NULL CHECK(author IN ('Mike','Rachael')),
 owner_email TEXT NOT NULL,
 title TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Behind the Counter',
 excerpt TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL DEFAULT '',
 cover TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 slug TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_owner ON articles(owner_email,updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug) WHERE slug IS NOT NULL;
