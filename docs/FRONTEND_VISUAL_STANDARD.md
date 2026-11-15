# Aladdin's Lamp — Frontend visual and navigation standard

Established: 15 November 2026. The approved visual character is a richly illustrated old shop: deep museum greens and browns, antique gold, warm parchment, elegant serif typography and the feeling of discovery. Never replace it with a generic commerce template.

## Seven primary rooms

| Route | Name | Approved desktop artwork | Approved mobile artwork |
|---|---|---|---|
| `#home` | Home | `assets/Aladdin’s Lamp Hidden Treasures Homepage.png` | `assets/Aladdin’s Lamp Hidden Treasures Poster.png` |
| `#hunt` | Treasure Hunt / Shop | `assets/treasure-hunt.jpg` | `assets/treasure-hunt-mobile.jpg` |
| `#silver` | Silver Vault | `assets/silver-vault.jpg` | `assets/silver-vault-mobile.jpg` |
| `#apothecary` | Rachael's Apothecary | `rachaels-apothecary.jpg` | `assets/rachaels-apothecary-mobile.jpg` |
| `#underground` | Autumn's Underground | `assets/autumns-underground.jpg` | `assets/autumns-underground-mobile.jpg` |
| `#fresh` | Fresh Finds | `assets/fresh-finds.jpg` | `fresh-finds-mobile.jpg` |
| `#journal` | Treasure Journal | `assets/treasure-journal.jpg` | `assets/treasure-journal-mobile.jpg` |

The Fresh Finds mobile art lives at repository root, **not** in `assets/`. Do not change approved source artwork without the creative owner's review. Mobile `<picture>` selects the mobile master at viewport width 680px or narrower.

## Navigation contract

- The approved artwork **already contains inconsistent painted navigation labels**. Never add a second `.art-nav` above the hero, and never hide all actual section labels behind transparent hitboxes. The hero starts at the top of the page. Desktop uses a single **visible**, keyboard-focusable `.image-nav .illustrated-links` overlay within the artwork's original header band, with seven section names, a highlighted active route, and an Explore menu trigger. It masks the conflicting painted wording without covering the central genie logo.
- Home uses a wider, single-row maroon/gold menu matching its original framed header. The six other illustrated rooms use a compact two-row menu fitted to the space left of their painted genie logos; Silver and Apothecary use artwork-specific widths. The existing painted search field remains available for the six illustrated interior rooms, with search accessible from Explore on Home.
- On mobile, the illustrated phone artwork's hamburger area has an accessible tap target. The home poster uses a small top-left icon. `Explore` opens the full accessible menu and search without creating a second visible navigation bar or overlapping article text.
- At tablet sizes, use the Explore control rather than tiny desktop artwork labels. Escape and outside clicks dismiss the menu.
- Navigation tests must check the **visible result**, not merely `nav` counts: assert `.art-nav` count is zero, hero top is unshifted, the seven labels have nonzero font size and readable color, the active tab is highlighted, desktop tabs navigate, search submits, and mobile Explore operates. Include screenshots of Home, Silver, Apothecary, Treasure Hunt and Journal on 1440px and phone layouts.
- Mobile Silver and Apothecary subcategory links are explicit, touch-friendly pills below the illustrated hero.
- All category links, branded home link, journal collections, search, and contact links should remain usable without JavaScript console errors or page-wide horizontal scrolling.

## Editorial and commerce boundary

- One Treasure Journal serves Rachael, Mike, and silver-related topical notes. Apothecary, Fresh Finds, and Silver Vault show selected journal cards below their approved hero art.
- The journal uses the existing D1/public feed and legacy fallbacks, never draft content on the public site.
- The `#catalog` section and `.catalog-grid[data-product-mount]` remain as stable future integration points. The current ornamental empty-cabinet message is not product data.
- Mike's agent owns product images, stock, inventory data, and operational integrations. Creative direction, site illustrations, typography, layouts, and interface finishes remain separately approved.
- Do not invent products, prices, customer testimonials or provenance. Sample articles should be clearly marked illustrative until authored and approved.

## Regression/release gate

- The draft branch `feature/treasure-journal-editor` runs `scripts/verify-journal-browser.cjs`, covering seven routes at widths 375, 430, 768, 1024, and 1440px plus author-editor integration.
- The production workflow `.github/workflows/site-visual-qa.yml` runs `scripts/verify-desktop-pages.cjs` after a successful Pages deployment at desktop (1920px), tablet (768px), phone (375px), and large phone (430px).
- Acceptance: each hero resolves to the approved asset; one visible current-state nav; no nav/art overlap, horizontal overflow, broken imagery or JavaScript errors; journal editorial rooms present; mobile links tappable; captured screenshots attached to workflow.
- Never merge the editor/backend development PR wholesale to release a visual change. Deploy minimal tested frontend diffs. Record the final commit SHA and successful visual QA URL.
