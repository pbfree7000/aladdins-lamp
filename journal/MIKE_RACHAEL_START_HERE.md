# Mike & Rachael — How to publish Treasure Journal stories

**Website:** https://aladdinslamp.xyz/#journal

**Editorial access:** Ask the repository owner to invite each of you as a GitHub collaborator with your own account. Do not share passwords or access tokens. Only invited editors can change the public Journal feed.

## Write a new story (current publishing method)
1. Sign into GitHub, then open [the Journal posts file](https://github.com/pbfree7000/aladdins-lamp/edit/main/journal/posts.json).
2. The file starts as `[]`. Each story goes inside the square brackets as a JSON object. Keep a comma **between** stories, but **not** after the final story.
3. Use this example as a template, replacing the words with your own:

```json
[
  {
    "slug": "welcome-to-the-shop",
    "title": "Welcome to Aladdin's Lamp",
    "author": "Mike",
    "date": "2026-11-14",
    "category": "Shop stories",
    "status": "published",
    "body": "Welcome to our family shop in Ravenna, Nebraska.\n\nThis is the next paragraph of our story."
  }
]
```

4. Use `"status": "draft"` to keep an entry hidden from visitors, or `"published"` to make it public.
5. Click **Commit changes**. GitHub Pages will automatically rebuild the site; publication may take a few minutes.
6. Open https://aladdinslamp.xyz/#journal and check your story. Click the story title for its unique link, then use **Share on Facebook**, **Pinterest**, **Share elsewhere**, or **Copy link**.

**Important:** This is a simple temporary GitHub editing method, not the planned friendly visual dashboard. Editing JSON incorrectly can break the feed. Drafts in this public GitHub repository are **not private** even when hidden from the website; do not put confidential drafts here. A proper authenticated editorial dashboard with private drafts and image uploads remains to be built.

## Images
Photo uploads and featured images are not supported in the current Journal feed yet. Ask for help before uploading pictures or changing the schema.

## Sharing
Use the **Share** controls on each published article. They link back to the Aladdin's Lamp website, not to a Facebook-only copy of the story. The Facebook preview image and description may be generic until dedicated article URLs and social metadata are implemented.
