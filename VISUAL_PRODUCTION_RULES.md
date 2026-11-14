# Aladdin's Lamp — Visual Production Rules

## Mandatory desktop + mobile pair

Every new or revised website rendering MUST include **two separately composed and approved assets** before publication:
- Desktop: full-width landscape composition with readable text and correct clickable artwork regions.
- Mobile: portrait composition designed specifically for narrow screens, with readable lettering, touch-sized links and deliberate layout. **Do not substitute a scaled-down landscape desktop image.**

Keep the approved illustrated vintage maximalist/pinball aesthetic and the same content, names, and navigation in both versions. Do not silently replace approved artwork with HTML banners or generic UI. Do not release a new visual on desktop alone.

## Release checklist
1. Produce desktop and portrait-mobile assets together, using explicit filenames (e.g. `home-coming-soon-desktop.png` and `home-coming-soon-mobile.png`).
2. Compare both with the approved composition and verify typography, content, and artwork.
3. Wire both into responsive HTML using `<picture>` or equivalent, preserving accessible links and tap targets.
4. Verify desktop and mobile rendering, image loads, navigation, and absence of runtime JavaScript errors.
5. Commit both assets and code, confirm GitHub Pages deployment succeeds, and inspect the live custom domain on desktop and mobile.
6. If any check is incomplete, report the exact limitation and do not claim that the release is finished.

Existing landscape-only mobile fallback is temporary, not an acceptable finished mobile design.
