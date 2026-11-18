# PROJECT PRESENTATION PLAN

> Evidence comes **only** from `port/src/components/Portfolio.jsx` (the `projects` array) and the screenshots in `port/public/image/`. Repository READMEs and live sites were **not** inspected in this batch. Before a project's presentation is built, its repository and live link should be checked by you, or by me with your permission.
> **Rule:** a visual representation may show *how a project is structured* or *what it does* according to its stated features. It must never imply scale, users, clients or results that are not documented.

## 1. Selection criteria (audience: recruiters and product companies)
1. Your verified role is substantial (creator, lead, end-to-end).
2. It works today, with a live link, repository, or video.
3. It shows engineering depth (architecture, APIs, AI, deployment), not just a UI clone.
4. It is distinct from the other flagships, so each tells a different story.

## 2. Flagship projects (SC08: Jupiter installations + Project Bay)

### F1 · SmartWay Traffic
| Field | Detail |
|---|---|
| Source | `Portfolio.jsx`; `Hero.jsx` (featured); image `public/image/traffic.png` |
| Functionality (as stated) | "Intelligent AI Traffic & Emergency Detection Management System. Powered by YOLOv8, FastAPI, and Eclipse SUMO with real-time detection for collisions, fire, and congestion." Features: live YOLOv8 computer-vision engine; collision and fire detection; SUMO traffic simulation integration. |
| Your role (stated) | Creator & Lead Developer |
| Stack | React, FastAPI, Node.js, PyTorch, YOLOv8, Supabase, Eclipse SUMO |
| Links | Live `smartway-traffic.vercel.app`; repo `github.com/23335a0504raju/smartway-traffic`; video (lnkd.in short link) |
| Visual representation | **The Tier 1 diorama**: a small stylised road junction with simulated traffic flow (a nod to SUMO), plus a "camera feed" panel that plays **your real demo video or screenshots**, with detection boxes only where they appear in that material. The diorama is labelled *"Illustrative visualisation"*. |
| Installation silhouette | A station with an observation ring and a sensor array (vision + simulation) |
| Why major | Lead role, AI and full-stack together, visually explainable, featured in your current hero |
| To confirm | Is the "real-time" detection running on live camera input, recorded video, or the simulation? This decides what the diorama may show. |

### F2 · DocumentDB: AI-Powered Document Intelligence Hub
| Field | Detail |
|---|---|
| Source | `Portfolio.jsx`; image `public/image/docintel.png` |
| Functionality (as stated) | Upload, preview, download and delete documents; RAG search across selected documents; chunking + embeddings + vector retrieval; conversational assistant; query history with sources; authenticated dashboard; cloud file storage. |
| Your role (stated) | Full-Stack Developer (end-to-end architecture, API design, RAG pipeline, deployment) |
| Stack | React.js, Node.js, Express.js, MongoDB Atlas, Mongoose, LangChain, OpenRouter API, JWT, Render, Vercel |
| Links | Live `document-db.vercel.app`; repo `github.com/23335a0504raju/DocumentDB`; LinkedIn demo post |
| Visual representation | **Tier 2+ (an animated pipeline, not a world).** The installation's modules light up in sequence: *document → chunks → embeddings → retrieval → answer with sources*. This is an honest architecture diagram in 3D, paired with real screenshots and the demo. |
| Installation silhouette | A linear station (a pipeline of modules) |
| Why major | Highly relevant to product companies (applied LLM/RAG), with a clear end-to-end ownership claim |
| To confirm | Which vector store is used (not stated); the screenshots to use |

### F3 · Stash: Social Media Saver
| Field | Detail |
|---|---|
| Source | `Portfolio.jsx`; image `public/image/stash.png` |
| Functionality (as stated) | Paste an Instagram or YouTube link → preview → save. One backend powering a React web app and a React Native mobile app. Saves WhatsApp Status on Android via the Storage Access Framework. Server-side API-key proxy; client-side direct download; no login, ad-free. |
| Your role (stated) | Full-Stack & Mobile Developer (React Native + Expo + Node.js) |
| Stack | React Native, Expo, EAS Build, React, Vite, Node.js, Express, TypeScript, RapidAPI, Vercel |
| Links | Live `build-it-ready.vercel.app`; repo `github.com/23335a0504raju/stash-mobile`; Expo build link |
| Visual representation | **Tier 2+**: a station with **one core and two docking arms** (web and mobile), showing the "one backend, two clients" architecture. Real phone and web screenshots appear in the Bay. The APK size reduction (218 MB → 29 MB) is shown **only if you confirm it**. |
| Why major | The only mobile project; architecture and security decisions are explicit |
| Risk to review | The product downloads third-party social media content. Confirm you're comfortable featuring it prominently for recruiters (platform terms of service). If not, swap in Campus Colab or Smart Stock. |

### Reserved slot · Spotmies work (MeraSports / Sports Paramount, Arcslot?)
These are **not in any source**. If they were internship work, they may belong in SC04 (experience), as a flagship, or both. Client/employer confidentiality may also limit what can be shown. **Needs your facts and permission.**

## 3. Supporting projects (SC07 belt beacons + dossiers)
Shown as names in the belt, opening a **Tier 2 dossier** (screenshot, description, stack, role, links). Full detail is in Mission Brief.

| Project | Source evidence | Role (stated) | Stack | Links | Recommendation |
|---|---|---|---|---|---|
| Campus Colab | `Portfolio.jsx`, `Hero.jsx`; `campus.png` | Full-stack Developer | React, Django REST, Vercel, Render | live, repo, docs, video | **Show.** It's in your current hero. "Real-time collaboration tools" needs confirming. |
| Smart Stock Management | `Portfolio.jsx`, `Hero.jsx`; `inventory.png` | Lead Developer & ML Engineer | React, Django REST, TensorFlow.js, Vercel, Render | live, repo, docs | **Show.** The ML forecasting claim should match the repository. |
| Object Detection | `Portfolio.jsx`; `object.png` | Full stack Developer | React, Django REST, Render (YOLOv8 nano per description) | live, repo | **Show** (small; complements SmartWay) |
| n8n Automation | `Portfolio.jsx`; `n8n.png` | "N8n Automation" | n8n, JavaScript, Docker, Render, Supabase | live, repo, video | **Show** (shows automation and Docker) |
| E-Commerce Platform (CodeAlpha) | `Portfolio.jsx`; `codealpha.png` | Frontend Developer Intern | React, Django REST, Vercel, Stripe API | live, repo, video | Show if the internship context is confirmed |
| Travel Pool | `Portfolio.jsx`; `travel.png` | Full-stack Developer | HTML, CSS, JS, PHP, jQuery, Google Maps API | live, repo, docs, video | **Brief only** (older stack) |
| 4 SEED – Farm Direct | `Portfolio.jsx`; `4seed.png` | Frontend Developer | HTML, CSS, JS, PHP, jQuery, MySQL | live, repo | **Brief only** |
| Fitness Tracker | `Portfolio.jsx`; `fibit.png` | Full Stack Developer | HTML, Django, Stripe API | live; **repo link points to profile root, not a repo** | **Brief only**, after fixing the repo link |
| Navi FrontEnd | `Portfolio.jsx`; `image.png` | — | JavaScript, React | live, repo | **Exclude.** Self-described as a clone; weak signal for recruiters. |

## 4. Presentation tiers (final)
| Tier | Treatment | Projects |
|---|---|---|
| **1: Diorama** | Installation + interactive mini-scene + Bay panel | SmartWay Traffic |
| **2+: Architecture installation** | Installation whose shape and animation explain the architecture + Bay panel with real media | DocumentDB, Stash |
| **2: Dossier** | Beacon in the belt → panel with screenshot, summary, stack, role, links | Campus Colab, Smart Stock, Object Detection, n8n, (E-Commerce) |
| **3: Brief only** | Listed in Mission Brief | Travel Pool, 4 SEED, Fitness Tracker |

## 5. Project Bay layout (all tiers)
1. Title, one-line purpose, **your role**, dates `[TO CONFIRM: not in source]`.
2. Media: diorama / animated architecture / real screenshots / video link.
3. "What it does": 3–5 stated features.
4. "How it's built": stack and a simple architecture sketch.
5. Links: Live · Code · Demo video.
6. Close (Esc) returns to the exact journey frame.

Screenshots will be re-encoded (AVIF/WebP, resized). The originals stay in the old repo.
