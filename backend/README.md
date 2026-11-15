# Aladdin's Lamp Treasure Journal — secure author backend

## Deployment status (15 Nov 2026 UTC)

- **Private Cloudflare Worker:** `aladdins-journal-api`, bound to `https://journal-api.aladdinslamp.xyz`.
- **Protected Writing Desk:** `https://journal-api.aladdinslamp.xyz/desk`. Cloudflare Access application `Aladdins Lamp Journal Authors` allows only Mike and Rachael's designated Google accounts.
- **Public read-only Worker:** `aladdins-journal-feed`, bound to `https://journal-feed.aladdinslamp.xyz/api/articles`.
- **D1 database:** existing `aladdins-lamp-journal`; new `articles` table with owner email, status, and optimistic update timestamp. Existing `posts` and `inventory` tables preserved.
- **Protected editor assets:** private Workers KV namespace `aladdins-journal-editor-assets`, key `desk-v1`. Update by uploading `writing-desk/index.html` to this KV key. This asset cannot be read through the public feed Worker.
- **Frontend integration:** development PR #1 only; main storefront remains unchanged.
- **Validation:** automated mock-JWT and mock-D1 tests in `backend/tests`. Real user sign-in and publishing tests must still be completed before launch.

## Workflow

Author opens the protected Writing Desk URL, signs in through Cloudflare Access, and writes. After connection, drafts save automatically in D1. The editor checks update timestamps to avoid silently overwriting newer edits from another device. Preview and Publish online are separate actions. Publishing changes D1 article status to `published`; the public Worker returns ONLY published fields. Existing static journal entries remain visible through the frontend fallback until the feed integration is merged.

## Maintain and test

```bash
cd backend
npm test
npm run build
npx wrangler deploy
```

After deploying code, upload the compiled HTML from `writing-desk/index.html` to the protected KV key `desk-v1`. `wrangler.toml` contains public resource identifiers but **does not contain logins or tokens**. The author email allowlist and Access AUD are configured in the Cloudflare Worker environment, not committed to the repository.

## Security limits

Cloudflare Access plus Worker-side JWT verification gates all protected routes, including `/desk`, `/api/articles`, and `/api/articles/:id/publish`. The API authorizes every article request by the verified email and author mapping. The public feed is a separate Worker with only read-only D1 access in its implementation and returns published stories. Keep the private Worker and public Worker on separate hostnames and never remove the Access policy.

Current UX does not yet support collaborative simultaneous editing, server-side revision history, inline image uploads, or article unpublishing. Cover images must use HTTPS URLs. Do not enter sensitive customer information in journal drafts. Do not merge the staging PR until CI and authenticated browser acceptance tests pass.
