# Treasure Journal — verified editorial workflow

**Public reading:** https://aladdinslamp.xyz/#journal

**Author Sign In (website):** https://aladdinslamp.xyz/journal/author.html

**Private Writing Desk:** https://journal-api.aladdinslamp.xyz/desk

Mike and Rachael enter through Aladdin's Lamp's branded author page, then continue through the existing Cloudflare Access email-verification gate into the private Writing Desk. No GitHub editor access or publishing token is required. Authentication happens in the protected app; the public site never handles passwords or OTPs.

In the private editor: start a story, enter its title, category, introduction and body; add cover and inline photographs; preview; let the online draft autosave; publish intentionally. Only published stories appear in the public Journal feed. Published articles have sharing controls. Each author is isolated from the other's drafts; owner review access is separate.

**Do not** use the old `journal/write.html` JSON composer or edit `journal/posts.json` to publish private drafts. The former composer now redirects to the Author Sign In entrance. Existing static JSON is only the public fallback for initial editorial examples.

Cloudflare Access may briefly display its secure identity-verification page. That is deliberate protection, not a requirement to create a Cloudflare account. A fully first-party authentication experience would require a separate supported authentication architecture and was not part of this frontend entrance.

**Real account acceptance still required:** each author should sign in with their configured email, reopen a saved draft, and verify the published article.
