# MISSION BRIEF (standalone portfolio, no WebGL)

## 1. Purpose
A complete, fast, accessible portfolio. It is **a first-class product, not an error page**. It serves:
- recruiters who want facts in 60 seconds;
- visitors without WebGL2, on weak devices or slow networks, or with Save-Data on;
- reduced-motion users who choose it;
- screen-reader and keyboard users;
- search engines and link previews (prerendered HTML).

## 2. Access
- URL: `raju-codes.me/brief/` (a separate entry in the same project).
- Linked from: the persistent UI on every journey frame, the loading screen (SC01), the WebGL failure notice, the reduced-motion prompt, and the contact panel.
- Section anchors match journey chapter IDs (`#crew-record`, `#strengths`, `#projects`, `#stack`, `#beyond`, `#contact`), so links work in both directions.
- The Brief offers "Experience the mission" **only** when the device passes the capability check.

## 3. Technology
- **Prerendered static HTML** at build time from the **same content module** as the journey.
- **No Three.js, no GSAP, no WebGL.** JavaScript is optional enhancement only (copy-email button, theme), and the page works fully with JavaScript disabled.
- CSS Modules and the shared design tokens give the same typography and accent colour, so it's visibly the same brand.
- Images are AVIF/WebP, sized responsively and lazy-loaded below the fold.

## 4. Structure
1. **Header:** name, role, availability line, [Email] [Resume PDF] [GitHub] [LinkedIn]. Mission emblem (small SVG).
2. **Summary:** 2–3 sentences (approved wording).
3. **Experience:** internships with dates and approved descriptions.
4. **Projects:**
   - Flagships as large cards (screenshot, purpose, role, stack, features, Live · Code · Demo).
   - Supporting projects as compact cards.
   - Tier 3 projects as a short list.
5. **Core strengths:** the approved 3–5.
6. **Technology stack:** grouped lists (the same groups as Saturn's rings).
7. **Education:** B.Tech, Diploma (+ secondary, optional).
8. **Certifications** (+ verified achievements, if any).
9. **Learning and next direction** (once you've written it).
10. **Contact:** the same component as the journey's contact panel.
11. **Footer:** credits and attributions for 3D assets (required by CC-BY), and a link to the journey.

## 5. Design
- Editorial, single column on mobile, two columns for project cards on wide screens.
- Same instrument-style typography and single accent colour as the journey. No gradients or glow.
- Print stylesheet: the Brief prints as a clean 2–3 page résumé-style document.
- Light and dark themes (dark default, matching the journey), honouring `prefers-color-scheme`.

## 6. Targets (to be measured; not yet tested)
- Lighthouse on mobile emulation: Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO ≥ 95.
- First contentful paint ≤ 1.5 s on "Fast 4G" emulation.
- JavaScript ≤ 30 KB gzipped (0 KB acceptable).
- Zero axe violations.

## 7. Content governance
Every string comes from the content module, with its source recorded (see `PORTFOLIO_CONTENT_MAPPING.md`). The build fails if any `[TO CONFIRM]` placeholder remains in production content.
