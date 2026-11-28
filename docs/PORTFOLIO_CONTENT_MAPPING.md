# PORTFOLIO CONTENT MAPPING

> **Source of truth:** the existing portfolio at `c:\projects\MainPortfolio\port` (read-only, inspected 2026-11-16).
> File paths are relative to `port/src/components/` unless stated otherwise.
> **Status legend:**
> - ✅ **Source**: stated once, consistently. Usable after your final read-through.
> - ⚠️ **Conflict**: sources disagree; you must choose.
> - ❓ **Unverified claim**: present in the source but a metric or award; needs your evidence before use.
> - ⛔ **Missing**: needed, but not in the source.

## 1. Identity
| Item | Value in source | Source | Status | Journey | Brief |
|---|---|---|---|---|---|
| Name | "Raju Chowdavada" (Hero, Connect); "CHOWDAVADA RAJU" (resume header) | `Hero.jsx`, `ResumeNew.jsx` | ⚠️ Order differs. Recommend "Raju Chowdavada". | SC01, SC02, SC13 | Header |
| Role / title | "Software Engineer" vs. "Full-Stack Software Engineer & AI Builder" | `ResumeNew.jsx`, `Hero.jsx` | ⚠️ Choose one | SC01, SC02, SC13 | Header |
| Summary | "Software Engineer specializing in scalable web applications, APIs, and full-stack systems using Java, Python, React.js, and Node.js. Proficient in optimizing application performance." | `ResumeNew.jsx` | ✅ (wording may be shortened with your approval) | SC03 | Intro |
| Location | Visakhapatnam, AP | `ResumeNew.jsx` | ✅ (optional to show) | SC13 | Contact |
| Email | `smilyraju8464@gmail.com` | `ResumeNew.jsx`, `Contact.jsx` | ✅. Confirm it's the address you want recruiters to use. | SC13, contact sheet | Contact |
| Photo | Supplied by Raju, 2026-11-28 | assets A061, A062 | ✅ Raju asked for it (2026-11-28, replaces "not used"): desk hologram (SC02/SC03), crew record (SC04), Mission Brief header | — | Header |

## 2. Experience
| Item | Value | Source | Status | Journey | Brief |
|---|---|---|---|---|---|
| Spotmies | Full-Stack Developer Intern, Dec 2025 – Jun 2026. "React.js and Node.js… backend APIs… deployments utilizing Vercel and Render." | `ResumeNew.jsx` | ✅ (description language is promotional; final wording `[TO CONFIRM]`) | SC04 | Experience |
| Pit Solutions | Frontend Development Intern, Dec 2022 – May 2023. "Responsive client-facing dashboards utilizing HTML, CSS, and JavaScript… Agile sprints." | `ResumeNew.jsx` | ✅ | SC04 | Experience |
| CodeAlpha | E-Commerce project described as "developed during internship", with role "Frontend Developer Intern" | `Portfolio.jsx` (project entry) | ⚠️ Is CodeAlpha an internship to list under Experience? | SC04 (if confirmed) | Experience / Projects |
| MeraSports / Sports Paramount, Arcslot | **Not present** in any source | — | ⛔ Provide facts, or remove from scope | — | — |
| "Years Exp. 1+" | Stat tile | `ResumeNew.jsx` | ❓ Recommend not showing; the dates speak for themselves | — | — |

## 3. Education
| Item | Value | Source | Status |
|---|---|---|---|
| B.Tech | "B.Tech in Computer Science and Engineering", MVGR College of Engineering, Aug 2023 – May 2026 | `ResumeNew.jsx` | ✅ |
| B.Tech specialisation | "including AI & ML" / "Specialized in AI and Machine Learning" | `About.jsx`, `Education.jsx` | ⚠️ Is AI & ML a formal specialisation? |
| CGPA | 8.31/10 (`ResumeNew.jsx`) vs 8.36 (`About.jsx`, `Portfolio.jsx`) | — | ⚠️ Choose one (or omit) |
| Diploma | Diploma in Computer Engineering, Government Polytechnic Anakapalli, Aug 2020 – May 2023, 83% | `ResumeNew.jsx`, `About.jsx` | ✅ |
| Secondary | Jubilee English Medium School, 98% (2019–2020) | `About.jsx`, `Education.jsx` | ✅ Recommend **Brief only** (low recruiter value) |

**Placement:** SC04 Crew Record (B.Tech and Diploma); Brief Education section.

## 4. Technical strengths (SC06)
There are none in the source as an explicit list (the "Specialties" are generic, with stock images). The proposal is derived **only from evidence in projects and experience**:

| Proposed strength | Evidence |
|---|---|
| Full-stack web applications | Spotmies role; DocumentDB, Campus Colab, Stash |
| APIs and backend systems | DocumentDB (Express, JWT), Stash (server-side API proxy), Django REST projects |
| Applied AI: computer vision and RAG | SmartWay (YOLOv8), Object Detection, DocumentDB (LangChain RAG) |
| Cloud deployment | Vercel and Render across projects; Docker (n8n) |
| Cross-platform mobile | Stash (React Native, Expo, EAS) |

Status: ❓ **`[TO CONFIRM]`. Pick 3–5 and approve the wording.**

## 5. Technology stack (SC09)
Source: `Portfolio.jsx` `techStack` (6 groups). The proposed ring bands are below.
- **Languages:** Java, Python, C/C++, TypeScript, JavaScript.
- **Frontend & mobile:** HTML5, CSS3, React, Vite, React Native, Expo.
- **Backend & APIs:** Node.js, Express.js, Django REST.
- **Data & cloud:** MySQL, PostgreSQL, MongoDB, Supabase, Vercel, Render, Docker.
- **AI & automation:** Machine learning (TensorFlow/TensorFlow.js), YOLOv8, LangChain/RAG, OpenRouter API, n8n.

**Excluded from the journey (Brief only, or dropped):**
- Bootstrap, Material UI, Cisco Packet Tracer, Apache/XAMPP, "Project Management", RapidAPI, EAS Build.
- **AWS** appears in `ResumeNew.jsx` ("AWS & Docker") but in no project. ⚠️ Keep only if you can support it.
- **Skill percentages** (`ResumeNew.jsx`) are rejected: they are unverifiable.

## 6. Projects
See `PROJECT_PRESENTATION_PLAN.md`. All project data comes from `Portfolio.jsx` (`projects` array); images are in `port/public/image/`.

## 7. Certifications (SC11 slot A)
From `ResumeNew.jsx`:
- Java Full Stack Developer (Wipro, 2025).
- Digital Business Skills (HP, 2025).
- GenAI Data Analytics Simulation (Tata iQ, 2025).
- AWS Solutions Architecture (Forage, 2024).
- Cloud Computing, 84% (NPTEL, 2024).
- Python Essentials 1 & 2 (Cisco, 2024).

Status: ✅ in source. Recommend linking credential URLs if available (⛔ none in source). Certificate images in `src/assets` (`btech.jpg`, `diploma.jpg`) are education documents. **Do not publish them without your decision.**

## 8. Achievements (SC11 slot B): all need evidence
| Claim | Source | Status |
|---|---|---|
| "Hackathon Finalist" (blogging platform, < 24 h) | `Portfolio.jsx` | ❓ Which hackathon? Also, the Fitness Tracker is described as "for hackathon". Are these the same or different events? |
| "450+ problems solved" (LeetCode and CodeChef) | `Portfolio.jsx`, `ResumeNew.jsx` | ❓ The LeetCode profile exists; the count needs confirming |
| "Optimized API response times by 25%" | `Portfolio.jsx` | ❓ Unverified metric. **Excluded unless evidenced.** |
| "99.9% uptime" | `Portfolio.jsx` | ❓ Unverified metric. **Excluded unless evidenced.** |
| "6+ full-stack apps" | `Portfolio.jsx`, `ResumeNew.jsx` | ❓ Countable from the project list; prefer showing the projects themselves |
| "Stash APK optimised 218 MB → 29 MB" | `Portfolio.jsx` (Stash features) | ❓ Specific and plausible. Usable if you confirm. |

## 9. Resume
| Item | Source | Status |
|---|---|---|
| "Download CV" Google Drive link (id ending `…X1l_`) | `ResumeNew.jsx` | ⚠️ |
| "Grab my latest resume" Google Drive link (id ending `…hThT`) | `Contact.jsx` | ⚠️ A different file from the one above. Which is current? |
| Recommendation | Host the PDF directly as `raju-codes.me/resume.pdf` (no Drive permission issues) | ⛔ Need the PDF |

## 10. Links
| Link | Source | Status |
|---|---|---|
| GitHub `github.com/23335a0504raju` | several | ✅ |
| LinkedIn `linkedin.com/in/raju-chowdavada-06b734347` | several | ✅ |
| LeetCode `leetcode.com/u/Raju_Ch8464/` | `ResumeNew.jsx`, `Contact.jsx` | ✅ |
| CodeChef `codechef.com/users/` (no username) | `ResumeNew.jsx` | ⚠️ Broken placeholder. Provide a username or drop it. |
| Twitter `twitter.com/` (no handle) | `Footer.jsx` | ⚠️ Placeholder. Drop it. |
| Instagram (personal) | `Footer.jsx` | Recommend **excluding** (recruiter audience) |

## 11. Things in the old site that will not carry over
- Unsplash stock photography (`About.jsx`, `Specialties.jsx`).
- Spline robot and Earth embeds.
- The non-functional contact form (`Connect.jsx` only logs to the console; messages never arrive).
- Skill percentage bars and stat tiles.

## 12. Security note
`port/.env` (one line, added in one commit) is **tracked in git**. Its value was not viewed. If it holds a credential, **rotate it**, remove it from tracking and add `.env` to `.gitignore`. A pattern scan of the other tracked source files found no secrets; the only matches were binary false positives in two PNGs.
