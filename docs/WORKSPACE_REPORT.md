# WORKSPACE REPORT (Batch 2, step 1)

> Inspection date: 2026-11-16. Read-only inspection. No existing file was modified. `.env` files were **not opened**.

## 1. What exists

| Location | What it is | Status |
|---|---|---|
| `c:\projects\Portfolio` | This project. Contains only `docs/` (Batch 1 documents). **Not a git repository.** | New home for the cinematic portfolio (recommended) |
| `c:\projects\MainPortfolio\port` | Current live portfolio (git remote `github.com/23335a0504raju/Portfolio`; sitemap points to `raju-codes.me`) | Working, deployed; **do not modify** |
| `c:\projects\MainPortfolio\crimson-cinematic-portfolio` | A Lovable-generated TanStack Start (SSR) + shadcn experiment with the same depth-parallax portrait hero | Experiment; not a base |
| Other folders (`ChatBot`, `Fashion Club`, `Mobile App`, `Sizzle`, `Wedding Invitation`, `study plan`) | Unrelated projects | Ignored |

### `port` (current portfolio) in detail
- **Build:** Create React App (`react-scripts 5.0.1`), JavaScript (JSX), with `typescript ~4.9.5` installed but unused. CRA is officially deprecated.
- **Routing:** `react-router-dom` v7, with routes `/` (single page of sections) and `/resume` (an HTML resume page).
- **Styling:** Tailwind CSS 3 (`tailwind.config.js`, class-based dark mode, Inter font), plus MUI + Emotion, plus component CSS files.
- **Animation / 3D:** `three 0.182`, `@react-three/fiber 9`, `drei 10`, `@react-three/postprocessing`, `gsap 3.14`, `lenis`, `framer-motion`, `particles.js`, `@splinetool/react-spline`, `react-scroll`. There are **three or four overlapping animation and scroll systems**.
- **Notable reusable code ideas:**
  - `HeroCanvas.jsx`: a depth-map parallax portrait shader with edge attenuation, plus device heuristics (`useIsTouch`, `useIsSmallScreen`, `useIsLowPower`) and conditional post-processing. The heuristics approach is worth carrying forward conceptually.
  - `SmoothScroll.jsx`: a Lenis setup on its own rAF loop (the pattern we will *not* reuse; see `STACK_DECISIONS.md`).
- **UI kit components** (`ui/glowing-card`, `orbiting-skills`, `3d-pin`, `bento-grid`, `card-stack`, …) are exactly the "generic AI portfolio" look that Batch 1 rejected.
- **Deployment:** no hosting config file found (no `vercel.json`, `netlify.toml`, or workflow). `public/robots.txt` and `sitemap.xml` exist. The host is unknown, so **please confirm**.
- **Assets:** `public/image/` (13 project screenshots, about 13 MB), `src/assets/` (about 12 MB: profile photos, certificates, icons), and `portrait-color.png` / `portrait-depth.png`.

### Where your personal information lives
The brief mentions *"a separate folder containing my personal information"*. **No such folder was found** in either workspace directory. Your information is currently **hard-coded inside the existing components**:

| Information | File (in `port/src/components/`) |
|---|---|
| Experience (2 internships), education (B.Tech, Diploma), skills, certifications, social links, email | `ResumeNew.jsx` |
| Projects (9 entries with role, stack and repo links) and an achievements list | `Portfolio.jsx` |
| Hero text and education details | `Hero.jsx`, `Education.jsx`, `About.jsx` |

**These were read but not modified, and not copied into the new docs.** Before Batch 3, they need your verification (see section 3).

## 2. Retain / improve / replace

| Item | Verdict | Reason |
|---|---|---|
| Your content (experience, education, projects, links, certificates) | **Retain → migrate** into a single typed content file, *after you verify it* | It is the substance of the portfolio |
| Project screenshots in `public/image/` | **Retain** (re-encoded to AVIF/WebP, resized) | Needed for Tier 2 project dossiers |
| Domain `raju-codes.me`, robots and sitemap | **Retain** | SEO continuity |
| Device-tier heuristics idea (`HeroCanvas.jsx`) | **Retain the concept** and extend it into the quality-tier system | Already proven on your site |
| Depth-parallax portrait shader | **Optional reuse** in the Mission Brief header | Nice, cheap and already yours |
| Skill "level %" bars (e.g. "React.js 88") | **Replace** | Unverifiable numbers; Batch 1 forbids invented metrics |
| Achievement labels such as "Algorithmic Expert" and "Full-Stack Mastery" | **Re-verify** | Must be backed by facts you approve |
| CRA build system | **Replace** (in the new project only) | Deprecated, slow, no modern ESM pipeline |
| MUI, Emotion, framer-motion, particles.js, Spline, react-scroll, react-icons, UI-kit components | **Do not carry over** | Overlapping systems and template aesthetic |
| `crimson-cinematic-portfolio` | **Do not use as a base** | Vendor-specific config (`@lovable.dev/vite-tanstack-config`) and SSR server we don't need |

**Recommendation:** build the new experience as a **fresh project in `c:\projects\Portfolio`**. Keep `port` live and untouched until the new site is approved, then switch the domain over. This is fully reversible, because the old site keeps working.

## 3. Findings that need your attention

1. ⚠️ **Security: `port/.env` is tracked in git** (and likely pushed to GitHub). Its contents were not inspected. If it contains any key or token, **rotate that secret**, then remove the file from git tracking and add `.env` to `.gitignore`. I have *not* changed anything.
2. `port/package.zip` (about 19 MB) and `package-lock.zip` are committed to the repo. This is probably accidental, and it bloats the repo.
3. **Content discrepancy:** Batch 1 lists *MeraSports / Sports Paramount* and *Arcslot*, but **neither appears anywhere** in the existing portfolio. The existing site lists other projects (SmartWay Traffic, Stash, Campus Colab, Smart Stock Management, a document-intelligence RAG app, 4 SEED, Travel Pool, Fitness Tracker, an e-commerce internship task). I need the facts for the two new projects, and your decision on which existing projects stay.
4. **No resume PDF** was found. The "resume" is an HTML route. Batch 1's "Download resume" needs a PDF from you.
5. `previous_portfolio.txt` is empty.
