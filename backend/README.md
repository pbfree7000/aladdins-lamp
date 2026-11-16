# Aladdin's Lamp Treasure Journal — secure author backend

## Deployment status (15 Nov 2026 UTC)

- **Private Cloudflare Worker:** `aladdins-journal-api`, bound to `https://journal-api.aladdinslamp.xyz`.
- **Protected Writing Desk:** `https://journal-api.aladdinslamp.xyz/desk`. Cloudflare Access application `Aladdins Lamp Journal Authors` allows only the owner plus Mike and Rachael's designated Google accounts. The owner is authenticated separately from either author.
- **Public read-only Worker:** `aladdins-journal-feed`, bound to `https://journal-feed.aladdinslamp.xyz/api/articles`.
- **D1 database:** existing `aladdins-lamp-journal`; new `articles` table with owner email, status, and optimistic update timestamp. Existing `posts` and `inventory` tables preserved.
- **Protected editor assets:** private Workers KV namespace `aladdins-journal-editor-assets`, key `desk-v1`. Update by uploading `writing-desk/index.html` to this KV key. This asset cannot be read through the public feed Worker.
- **Frontend integration:** the public D1 feed reader and original three articles are already on `main` (`eed8010`). The unfinished editor/backend source stays in draft PR #1.
- **Validation:** automated mock-JWT and mock-D1 tests in `backend/tests`. Real user sign-in and publishing tests must still be completed before launch.

## Workflow

Author opens the protected Writing Desk URL, signs in through Cloudflare Access, and writes. After connection, drafts save automatically in D1. The editor checks update timestamps to avoid silently overwriting newer edits from another device. Preview and Publish online are separate actions. Publishing changes D1 article status to `published`; the public Worker returns ONLY published fields. Existing static journal entries remain visible as a fallback. Published stories display in the public Journal. Published articles offer Facebook, Pinterest, native share and Copy Link controls; the private Desk also offers Facebook and native sharing.

## Maintain and test

```bash
cd backend
npm test
npm run build
npx wrangler deploy
```

After deploying code, upload the compiled HTML from `writing-desk/index.html` to the protected KV key `desk-v1`. `wrangler.toml` contains public resource identifiers but **does not contain logins or tokens**. The author email allowlist, `OWNER_EMAIL`, Access team domain and Access AUD are configured in the Cloudflare Worker environment, not committed to the repository. Preserve all existing D1, KV and Access bindings when redeploying. Cloudflare Access must allow all three exact Google accounts, but the Worker must separately map only the two authors in `ALLOWED_AUTHORS` and the owner's exact address in `OWNER_EMAIL`. Owner can list both authors' records, edit drafts and publish approved stories; owner cannot create or delete author stories. Real-account acceptance remains required.

## Security limits

Cloudflare Access plus Worker-side JWT verification gates all protected routes, including `/desk`, `/api/articles`, and `/api/articles/:id/publish`. The API authorizes every article request by the verified email and author mapping. The public feed is a separate Worker with only read-only D1 access in its implementation and returns published stories. Keep the private Worker and public Worker on separate hostnames and never remove the Access policy.

Current UX does not yet support collaborative simultaneous editing, server-side revision history, inline image uploads, or article unpublishing. Cover images must use HTTPS URLs. Do not enter sensitive customer information in journal drafts. Do not merge the staging PR until CI and authenticated browser acceptance tests pass.

## Real-account acceptance and handoff checklist

1. Sign in as owner at `/desk` and verify both authors' records are visible; confirm the owner cannot create or delete an author story.
2. Sign in separately as Mike and Rachael and confirm each can only view their own articles and cannot open another author's article ID.
3. Create a draft, confirm autosave, reload and reopen it; edit from another device and verify stale-save and stale-publish conflicts are rejected.
4. Publish one explicitly approved article and confirm it appears in `journal-feed.aladdinslamp.xyz/api/articles` and on the public Journal, never exposing an unpublished draft.
5. Test the private Desk Facebook and Share story controls after publishing, plus the public Journal's Facebook, Pinterest, native share and Copy Link controls. Platform previews still need per-article metadata validation; URL fragment links are not sufficient for reliable rich previews.
6. Record deployment version, KV key, Worker bindings, Access policy, D1 database ID, and a tested rollback before transferring operational maintenance.

**Do not merge draft PR #1 wholesale without acceptance.** Keep the creative storefront and approved artwork under separate design ownership; product catalog/data/photos are managed by Mike's agent.

## Journal cover photograph upload (15 November 2026)

Photo upload now uses a dedicated R2 bucket `aladdins-lamp-journal-photos` and the `journal_photos` D1 table. Both the **private API** and the **public feed** Workers require the R2 binding `JOURNAL_PHOTOS`. Keep it bound when redeploying either script. The private API accepts only verified JPG, PNG, WebP or GIF files up to 5 MB, tied to a draft owned by the authenticated author (or overseen by the owner). Private image previews require Access authentication. The public feed returns image bytes only if the linked story is published. Its endpoint is `/media/:photoId`.

The protected Writing Desk now supports choosing a cover photograph from laptop or phone files, taking a photo on a mobile camera, dropping a photo onto the cover field, and pasting an image while the cover field is focused. The Writing Desk now has a **visual block editor**. Authors can write paragraphs, paste a copied image at the text cursor, drag in a photo, or add multiple photographs from phone/laptop files. The editor stores body content as the string prefix `ALADDIN_BLOCKS_V1:` followed by JSON blocks. Supported block kinds: `text` (paragraph, heading, quote, list) and `image` (verified UUID ID, optional caption, size, alignment). Render these blocks with text escaping and allowlisted photo IDs; never render arbitrary stored HTML. Image blocks refer to the existing private R2 metadata keyed to the article, and the public feed only serves them after publication. A story must contain readable text, not only image blocks. Legacy plain-text stories continue to work without migration.

Photo cards support desktop drag reordering, mobile-accessible Move Up/Down buttons, left/center/right alignment, and small/medium/full size. These controls save automatically. Real-device acceptance is still required. Full historical revision history remains unfinished. A real Mike/Rachael phone and laptop upload acceptance check is still required.

Deployment: `backend/wrangler.toml` includes the **private API** R2 binding. The separate **public feed** Worker is deployed with its own `DB` D1 and `JOURNAL_PHOTOS` R2 bindings; preserve these when publishing the read-only Worker. Do not use the unrelated BINDEX R2 bucket or place journal photos in product-image storage.

## Inline visual editor regression

The Chromium integration check covers file uploads, pasted clipboard images, reorder controls, saved image placement, and published-body rendering. Retain these tests when maintaining the editor. The public storefront's `index.html` renders the same `ALADDIN_BLOCKS_V1:` format; whenever the format changes, update its allowlisted renderer together with the editor and backend tests. Preserve the static fallback articles and the approved illustrations.

## Public editorial architecture (15 November 2026)

The storefront uses **one Treasure Journal**. Public story entries are stored once in D1 and served by `journal-feed.aladdinslamp.xyz/api/articles`. Three museum-style editorial entrances on the existing illustrated storefront lead to filtered views of the same stories:

- `#apothecary` features **The Apothecary Notebook** → `#journal/collection/rachael`, matching published posts by author `Rachael` or legacy apothecary categories.
- `#fresh` features **Mike’s Finds & Field Notes** → `#journal/collection/mike`, matching ALL of Mike's published stories regardless of category; selected original generic Treasure Keepers stories are also visible until Mike publishes.
- `#silver` features **Notes from the Silver Vault** → `#journal/collection/silver`, matching published silver-category stories by either author. This is a thematic filter, **not** a separate journal database or second author workflow.

The hub `#journal` includes these three editorial rooms and all latest stories, while existing article links remain `#journal/<slug>`. Editorial room/shelf cards use the existing AL palette, typography, illustrated hero assets, antique gold and parchment treatment; don't replace approved artwork with a generic storefront. The existing legacy static journal posts remain as a fallback while new D1 stories accumulate. If changing filters or `ALADDIN_BLOCKS_V1:` rendering, update browser QA in `scripts/verify-journal-browser.cjs` and keep the live storefront change isolated from the draft editor PR.

## Editing a previously published story

Authors can open their own published story, select **Edit Published Article**, replace the cover or insert/reorder inline photographs, update text, and preview changes. A published edit is a **private local working copy**; automatic cloud draft saving does not modify the live story. The author commits changes with **Update Live Article** and a confirmation dialog. The live record retains its original `slug` and `published_at` values, preserving existing Facebook and other shared links. Only `title`, `category`, `excerpt`, `body`, `cover` and `updated_at` change.

Server API: `POST /api/articles/:id/revise` requires the authenticated author (or authorized owner), article status `published`, complete validated article data, and `expectedUpdatedAt` optimistic version check. On another-device conflict, it returns HTTP 409 and the editor retains the uncommitted local copy for export; it does not overwrite the other device. Cover image link validation also applies to revisions. `POST /api/articles/:id/photos` accepts securely uploaded new photos for published stories; the public feed serves a photo **only after** that photo is referenced by the committed cover or body. Old photos remain privately stored rather than deleted.

Do not change the live story via ordinary draft `PUT` calls; these intentionally remain restricted to draft records. Reloading a published story while it has unpublished local edits must retain the local working copy for that authenticated account. The public feed continues to expose only committed published data. A full multi-version rollback history is not yet implemented; the author can export a backup before editing.
