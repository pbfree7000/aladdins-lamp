-- Additive D1 migration: immutable per-save snapshots (do not recreate articles or change published slugs).
-- Run in order; the backfill is the earliest available snapshot for pre-migration articles.
-- JOURNAL-MIGRATION-STEP
CREATE TABLE IF NOT EXISTS article_revisions (
 article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version > 0),
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 excerpt TEXT NOT NULL,
 body TEXT NOT NULL,
 cover TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','published')),
 slug TEXT,
 published_at TEXT,
 source_updated_at TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 PRIMARY KEY (article_id,version)
);
-- JOURNAL-MIGRATION-STEP
CREATE INDEX IF NOT EXISTS idx_article_revisions_newest ON article_revisions(article_id,version DESC);
-- JOURNAL-MIGRATION-STEP
INSERT INTO article_revisions(article_id,version,title,category,excerpt,body,cover,status,slug,published_at,source_updated_at,recorded_at)
SELECT a.id,1,a.title,a.category,a.excerpt,a.body,a.cover,a.status,a.slug,a.published_at,a.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM articles a
WHERE NOT EXISTS(SELECT 1 FROM article_revisions r WHERE r.article_id=a.id);
-- JOURNAL-MIGRATION-STEP
CREATE TRIGGER IF NOT EXISTS trg_articles_revision_insert
AFTER INSERT ON articles
BEGIN
 INSERT INTO article_revisions(article_id,version,title,category,excerpt,body,cover,status,slug,published_at,source_updated_at,recorded_at)
 VALUES(NEW.id,1,NEW.title,NEW.category,NEW.excerpt,NEW.body,NEW.cover,NEW.status,NEW.slug,NEW.published_at,NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
-- JOURNAL-MIGRATION-STEP
CREATE TRIGGER IF NOT EXISTS trg_articles_revision_update
AFTER UPDATE ON articles
WHEN NEW.title IS NOT OLD.title OR NEW.category IS NOT OLD.category
 OR NEW.excerpt IS NOT OLD.excerpt OR NEW.body IS NOT OLD.body
 OR NEW.cover IS NOT OLD.cover OR NEW.status IS NOT OLD.status
 OR NEW.slug IS NOT OLD.slug OR NEW.published_at IS NOT OLD.published_at
BEGIN
 INSERT INTO article_revisions(article_id,version,title,category,excerpt,body,cover,status,slug,published_at,source_updated_at,recorded_at)
 VALUES(NEW.id,(SELECT COALESCE(MAX(version),0)+1 FROM article_revisions WHERE article_id=NEW.id),
 NEW.title,NEW.category,NEW.excerpt,NEW.body,NEW.cover,NEW.status,NEW.slug,NEW.published_at,NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
