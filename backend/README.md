# Journal backend

D1 database created: `aladdins-lamp-journal` (US jurisdiction). Schema: `posts` with id, slug, title, author, category, body, status, created_at, updated_at, published_at.

`journal-worker.js` is a **staged, read-only API**. It is not yet deployed or attached to the public website. All write requests return 403. Do not enable writes without verified Cloudflare Access identity and an explicit allowlist of Mike and Rachael's verified accounts, plus CSRF/origin protections and input validation.

Next: configure protected editorial Worker, test authorization (unauthenticated requests denied), add draft CRUD and publish endpoint, attach D1 binding, add authenticated visual editor, update public Journal to fetch published entries, support photos via controlled storage, and implement canonical shareable article URLs with Open Graph metadata.

Do not store secrets or credentials in this repository. Keep draft content in D1, never in the public GitHub repo.
