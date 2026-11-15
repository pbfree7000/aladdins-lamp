# Treasure Journal — publishing guide

The Treasure Journal is edited in `journal/posts.json` on the website repository. No separate blogging account is required. The public site loads only entries with `"status": "published"`.

## Add a story
1. Add a new object at the start of the JSON array.
2. Give it a permanent, lowercase hyphenated `slug` (e.g. `how-to-care-for-vintage-silver`). Do not change the slug after sharing a story.
3. Fill in `title`, `date` (YYYY-MM-DD), `author`, `category`, `excerpt`, and `body`. Separate paragraphs in `body` with `\\n\\n`.
4. Use `"status": "draft"` until editorial approval; switch to `"published"` when ready.
5. Validate JSON before committing. The public Journal and search update automatically after deployment.

Example:
```json
{
  "slug": "a-new-discovery",
  "title": "A New Discovery",
  "date": "2026-11-15",
  "author": "The Treasure Keepers",
  "category": "Behind the Counter",
  "status": "draft",
  "excerpt": "A brief introduction for listings and search.",
  "body": "First paragraph.\\n\\nSecond paragraph."
}
```

## Sharing
A story's permanent public link is `https://aladdinslamp.xyz/#journal/<slug>`. The site provides Facebook, Pinterest, native share (where supported), and copy-link actions. `journal/feed.xml` is a **static RSS file** and must be updated when publishing or revising stories; it does not regenerate itself from JSON. Do not promise automatic feed updates until a build workflow is implemented.

## Editorial and legal checks
- Check all claims about provenance, materials, authenticity, and prices before publishing.
- Never invent a customer's story, a specific item's history, or staff quotes.
- Avoid medical claims about botanical products. Include sensible ingredient and allergy context when appropriate.
- Secure permission before using customer images or identifying details.
- Avoid adding external scripts, customer forms, or payment collection without a privacy/security review.

## Product integration
Articles may later link to real inventory product IDs. Do not insert fictional SKUs or checkout URLs. Mike's operational inventory workflow remains separate from the editorial and visual design decisions.
