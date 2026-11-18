# CONTACT EXPERIENCE

## 1. Goals
1. A satisfying ending: the journey comes home.
2. Contact is **instant and obvious**: name, role, email, resume and links are visible together.
3. Contact is **reachable without finishing the journey**: from SC01 onward, at any moment.

## 2. Three ways to reach contact
| Entry | Behaviour |
|---|---|
| **Persistent "Contact" button** (always visible) | Opens a **contact sheet overlay** immediately, with no travel. Esc or close returns the visitor to the exact frame. |
| **Flight Plan → Contact** | Jumps to SC13 (the cinematic ending) with a short fade. |
| **Natural arrival** | The final scroll section, SC13 |
| **Mission Brief** | The Contact section (no WebGL) |

The overlay and SC13 use **the same content component**, so they can never disagree.

## 3. The SC13 scene (cinematic ending)
- **Setting:** the ship in high orbit, Earth below at sunrise (a bookend with the opening window view).
- **Action:** the astronaut steps onto the hull or an exterior platform and deploys a beacon (a cut covers the planting). The beacon pulses, the **mission emblem completes** its final segment, and the camera settles into a calm, wide hold.
- **Layout:** the contact panel sits on one side (left on desktop, bottom sheet on mobile). The 3D scene stays visible but secondary, darkened behind the panel by a scrim for contrast.
- **No auto-advance and no further scroll.** The page ends; the visitor can stay as long as they like.

## 4. Contact panel content (all from source; see `PORTFOLIO_CONTENT_MAPPING.md`)
| Element | Value | Status |
|---|---|---|
| Name | Raju Chowdavada | ⚠️ Confirm name order |
| Role | `[TO CONFIRM]` "Software Engineer" or "Full-Stack Software Engineer & AI Builder" | ⚠️ |
| Availability line | e.g. "Open to full-time software engineering roles" | ⛔ You must provide or approve this |
| **Email** (primary action) | `smilyraju8464@gmail.com`, as a `mailto:` link + **Copy** button | ✅ Confirm it's your recruiter-facing address |
| **Resume** (primary action) | `/resume.pdf`, served directly | ⛔ Need the PDF (two different Drive links exist in the source) |
| GitHub | `github.com/23335a0504raju` | ✅ |
| LinkedIn | `linkedin.com/in/raju-chowdavada-06b734347` | ✅ |
| LeetCode | `leetcode.com/u/Raju_Ch8464/` | ✅ (optional) |
| Location | Visakhapatnam, Andhra Pradesh | ✅ (optional) |
| Secondary actions | "Mission Brief" · "Replay mission" | — |

**Excluded:** the Instagram link (personal), the placeholder Twitter and CodeChef links, and a phone number (not in the source; don't add one unless you want it).

## 5. Contact form decision
The existing site's form **never sends messages** (`Connect.jsx` only logs to the console). For the new site:
- **Recommended:** no form at launch. `mailto:` plus copy-email is reliable, accessible, and needs no backend or spam protection.
- **Option (later):** a Vercel serverless function with a transactional email provider and a spam honeypot. This adds a backend and a privacy notice, so it's only worth doing if you want it.

## 6. Accessibility and behaviour
- The panel is real HTML. Heading order: name (h2 within the section), role, actions.
- **Focus moves to the panel heading** on arrival or overlay open. The overlay traps focus, Esc closes it, and focus returns to the trigger.
- The Copy button announces "Email copied" through an `aria-live` region.
- Contrast is WCAG AA against the scrim. Touch targets are at least 44 px.
- Reduced motion: a still frame of the ending with the panel, and no beacon animation.
- Works with the WebGL canvas absent (the overlay version is pure DOM).

## 7. Metadata
The page title, description and Open Graph image (a still from SC13) represent name, role and domain `raju-codes.me`. The existing `index.html` description is a placeholder ("Your website description") and will be replaced.
