"""Validate additive D1 revision migration with stock SQLite, including legacy backfill."""
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
migration = (root / "migrations" / "002_article_revisions.sql").read_text()
schema = (root / "schema.sql").read_text()
legacy_schema = schema.split("-- Article revision history, included for fresh database installs.")[0]
steps = [step.strip() for step in migration.split("-- JOURNAL-MIGRATION-STEP") if step.strip() and not step.strip().startswith("-- Additive")]

def version_rows(connection, article_id):
    return connection.execute(
        "SELECT version,title,status,slug,body FROM article_revisions WHERE article_id=? ORDER BY version",
        (article_id,),
    ).fetchall()

def add_article(conn, article_id, status="draft", title="Ginger", slug=None):
    conn.execute("""INSERT INTO articles
      (id,author,owner_email,title,category,excerpt,body,cover,status,slug,created_at,updated_at,published_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
        article_id, "Rachael", "rachael@example.com", title, "Rachael’s Apothecary",
        "A botanical note", "Story v1", "", status, slug,
        "2026-11-15T10:00:00Z", "2026-11-15T10:00:00Z",
        "2026-11-15T10:00:00Z" if status == "published" else None
    ))

with sqlite3.connect(":memory:") as db:
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(legacy_schema)
    add_article(db, "legacy", status="published", slug="ginger-more-than-a-spicy-herb")
    for step in steps:
        db.executescript(step)
    assert len(version_rows(db, "legacy")) == 1, "A legacy published story needs a baseline"
    assert version_rows(db, "legacy")[0][3] == "ginger-more-than-a-spicy-herb"
    for step in steps:
        db.executescript(step)
    assert len(version_rows(db, "legacy")) == 1, "Migration must be idempotent"

    db.execute("UPDATE articles SET body=?,updated_at=? WHERE id=?", (
        "Story v2", "2026-11-16T10:00:00Z", "legacy"
    ))
    assert [row[0] for row in version_rows(db, "legacy")] == [1, 2]
    assert version_rows(db, "legacy")[0][4] == "Story v1", "Old snapshot must not change"

    db.execute("UPDATE articles SET updated_at=? WHERE id=?", ("2026-11-16T10:01:00Z", "legacy"))
    assert len(version_rows(db, "legacy")) == 2, "Timestamp-only save is not a meaningful version"

    db.execute("UPDATE articles SET body=?,updated_at=? WHERE id=?", (
        "Story v1", "2026-11-16T10:02:00Z", "legacy"
    ))
    assert [row[0] for row in version_rows(db, "legacy")] == [1, 2, 3]
    assert version_rows(db, "legacy")[2][4] == "Story v1", "Restore must create new version"
    assert db.execute("SELECT slug FROM articles WHERE id='legacy'").fetchone()[0] == "ginger-more-than-a-spicy-herb"

    add_article(db, "new-draft")
    assert len(version_rows(db, "new-draft")) == 1, "Fresh drafts should start at version 1"
    db.execute("UPDATE articles SET status='published',slug='new-draft-story',published_at='2026-11-16T12:00:00Z' WHERE id='new-draft'")
    assert [row[2] for row in version_rows(db, "new-draft")] == ["draft", "published"]

with sqlite3.connect(":memory:") as fresh:
    fresh.execute("PRAGMA foreign_keys=ON")
    fresh.executescript(schema)
    add_article(fresh, "fresh")
    assert len(version_rows(fresh, "fresh")) == 1, "Complete fresh-install schema should log initial version"

print("PASS: idempotent legacy migration, D1-compatible triggers, immutable snapshots, restore-as-new-version, original slugs, and fresh installs")
