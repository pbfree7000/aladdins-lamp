# Aladdin's Lamp — Frontend visual and navigation standard

Established: 15 November 2026. The approved visual character is a richly illustrated old shop: deep museum greens and browns, antique gold, warm parchment, elegant serif typography and the feeling of discovery. Never replace it with a generic commerce template.

## Seven primary rooms — navigation-free hero release

| Route | Page | Live desktop hero | Live mobile hero |
|---|---|---|---|
| `#home` | Home | `assets/home-navfree.jpg` | original illustrated poster (contains no menu bar) |
| `#hunt` | Treasure Hunt / Shop | `assets/treasure-hunt-navfree-fixed.jpg` | same clean image, responsive crop |
| `#silver` | Silver Vault | `assets/silver-vault-navfree.jpg` | same clean image, responsive crop |
| `#apothecary` | Rachael's Apothecary | `assets/rachaels-apothecary-navfree-fixed.jpg` | same clean image, responsive crop |
| `#underground` | Autumn's Underground | `assets/autumns-underground-navfree-fixed.jpg` | same clean image, responsive crop |
| `#fresh` | Fresh Finds | `assets/fresh-finds-navfree-fixed.jpg` | same clean image, responsive crop |
| `#journal` | Treasure Journal | `assets/treasure-journal-navfree-fixed.jpg` | same clean image, responsive crop |

The originals remain untouched. The previous `scripts/produce_navfree_heroes.py` applied a vertical remapping to the upper artwork and visibly stretched people, hair, signs and other subjects. It is superseded by `scripts/restore_unwarped_heroes.py`, which retouches only the original navigation strip, preserves every pixel below that strip before JPEG encoding, and records a quantitative fidelity audit. Never reintroduce the remap method.

## Navigation contract

- Exactly **one real, accessible `.clean-top-nav`** is rendered above the illustration on every route. No opaque rectangles masking artwork, no embedded navigation in the active source and no hidden links over inconsistent painted labels.
- Desktop includes seven visible room links and the active page selection, plus real search. Tablet/phone uses the current page's heading and Explore menu with accessible search.
- The navigation is a normal site component; its content is not part of the image. The Home poster is deliberately retained for phones, while interior pages use the nav-free desktop artwork with mobile cropping.
- The approved original branding, illustrations, museum colors and typography remain the visual reference. Source nav removal can introduce subtle alterations near the top of the images; release only after screenshot review.
- GitHub's responsive production QA checks all seven routes at 1920, 768, 430 and 375 pixels, verifies one clean header, expected image paths, active links, menu/search, and no horizontal overflow. Keep screenshot artifacts for signoff.

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

## Source-art navigation cleanup (15 November 2026)

Silver Vault and Home were already made with non-warping cleanup. The other five have been rebuilt from their undistorted originals. The seven rooms share one real `.clean-top-nav` component; no art-embedded navigation or visual black overlay is used. The decorative Silver Vault metals board is illustrative, not a verified live market feed.\n
## Geometric distortion regression gate

- **Source truth:** the unchanged original hero JPEGs, not a previously stretched nav-free derivative.
- **Repair region:** 33–57 top rows (by source resolution), strictly confined to left/right baked-in header details. The central logo and every pixel below the header are identical to the original *before JPEG export*.
- **Audit:** `python scripts/restore_unwarped_heroes.py` asserts source geometry is unchanged and records JPEG decode differences below the retouch. Browser QA verifies correct `*-navfree-fixed.jpg` sources on all affected desktop/mobile routes. Both run before release.
- **Forbidden:** vertical remapping (`cv2.remap`) or rescaling any person's hair, face, hands, sign, logo, or merchandise to remove navigation.
