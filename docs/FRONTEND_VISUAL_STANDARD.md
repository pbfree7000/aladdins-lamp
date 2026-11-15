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

- The functional `.art-nav` stays **outside and above** the hero; never overlay it on art. There is exactly one main navigation on any route.
- Desktop uses the original antique-gold serif horizontal navigation and search. For compact desktop widths, search is available through Explore instead of crowding the room links.
- At 980px and narrower, a modest branded masthead and horizontally scrollable, visible room navigation remain above the hero. The active section is centered in view. Explore opens the full accessible menu and mobile search.
- The fixed Explore button is always operable, and Escape/outside clicks dismiss the menu.
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
