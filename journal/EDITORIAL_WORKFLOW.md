# Treasure Journal — editorial workflow

The public Journal reads `journal/posts.json` and displays entries with `status: "published"`.

## Proposed publishing flow

1. Mike and Rachael sign into a private authenticated editorial dashboard (not yet installed).
2. Create articles with title, author, date, body, photographs and categories; save drafts.
3. Review and approve content before publication.
4. Publish to the GitHub repository, triggering GitHub Pages deployment.

## Current state

The public reading page and empty JSON feed exist. **There is no authenticated editor, draft workflow, image upload or publishing dashboard yet.** Do not distribute GitHub access tokens or embed secrets in public site code. Authentication and editor selection must be completed before inviting editors.

Example record:

```json
{"title":"Welcome to Aladdin's Lamp","author":"Mike","date":"2026-11-14","status":"draft","body":"A story in paragraphs.","category":"Shop stories"}
```

Only `published` records display publicly. Photos require a reviewed, secure asset workflow before use.
