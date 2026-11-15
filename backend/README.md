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
