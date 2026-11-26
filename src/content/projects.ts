import { fromSource, missing, unverified } from './fact.ts';
import { SRC } from './sources.ts';
import type { Project } from './types.ts';

const P = [SRC.portfolio];
const img = (file: string) => fromSource(`${SRC.images}/${file}`, [SRC.images]);

/**
 * Personal projects, from the `projects` array in Portfolio.jsx.
 * Tiers follow PROJECT_PRESENTATION_PLAN.md. Internship projects live in experience.ts.
 */
export const projects: readonly Project[] = [
  // ── Flagships (Jupiter installations) ─────────────────────────────────────
  {
    id: 'smartway-traffic',
    tier: 'diorama',
    name: fromSource('SmartWay Traffic', [SRC.portfolio, SRC.hero]),
    summary: fromSource(
      'AI traffic and emergency detection management system using YOLOv8, FastAPI and Eclipse SUMO, detecting collisions, fire and congestion.',
      [SRC.portfolio, SRC.postSmartWay],
      'Q10 answered by the SmartWay LinkedIn post: YOLOv8 detection on camera frames, plus Eclipse SUMO simulation files as input "instead of relying purely on live cameras". The diorama may show both.',
    ),
    role: fromSource('Creator & Lead Developer', P),
    stack: fromSource(
      ['React', 'FastAPI', 'Node.js', 'PyTorch', 'YOLOv8', 'Supabase', 'Eclipse SUMO'],
      P,
    ),
    features: fromSource(
      [
        'YOLOv8 computer-vision detection engine',
        'Collision and fire detection',
        'Eclipse SUMO traffic simulation integration',
      ],
      P,
    ),
    links: fromSource(
      {
        live: 'https://smartway-traffic.vercel.app/',
        code: 'https://github.com/23335a0504raju/smartway-traffic',
        demo: 'https://lnkd.in/g82autWn',
      },
      P,
    ),
    image: img('traffic.png'),
  },
  {
    id: 'documentdb',
    tier: 'architecture',
    name: fromSource('DocumentDB: AI-Powered Document Intelligence Hub', P),
    summary: fromSource(
      'Document management system where users upload, organise and query their files with RAG-based AI search and Q&A powered by OpenRouter LLMs.',
      P,
    ),
    role: fromSource(
      'Full-Stack Developer (end-to-end architecture, API design, RAG pipeline, deployment)',
      P,
    ),
    stack: fromSource(
      [
        'React',
        'Node.js',
        'Express',
        'MongoDB Atlas',
        'Mongoose',
        'LangChain',
        'OpenRouter API',
        'JWT',
        'Render',
        'Vercel',
      ],
      P,
      'Vector store not stated in source. Confirm.',
    ),
    features: fromSource(
      [
        'Upload, preview, download and delete documents',
        'RAG search across selected documents (chunking, embeddings, vector retrieval)',
        'Conversational assistant with query history, sources and references',
        'Authenticated dashboard',
      ],
      P,
    ),
    links: fromSource(
      {
        live: 'https://document-db.vercel.app/',
        code: 'https://github.com/23335a0504raju/DocumentDB',
        demo: 'https://www.linkedin.com/posts/raju-chowdavada-06b734347_ai-artificialintelligence-rag-activity-7405219264825073664-Gq0S',
      },
      P,
    ),
    image: img('docintel.png'),
  },
  {
    id: 'stash',
    tier: 'architecture',
    name: fromSource('Stash: Social Media Saver', P),
    summary: fromSource(
      'Cross-platform media saver: paste an Instagram or YouTube link, preview it and save it. One backend powers both a React web app and a React Native mobile app.',
      P,
      'Confirm you are comfortable featuring this for recruiters (Q9).',
    ),
    role: fromSource('Full-Stack & Mobile Developer (React Native, Expo, Node.js)', P),
    stack: fromSource(
      [
        'React Native',
        'Expo',
        'EAS Build',
        'React',
        'Vite',
        'Node.js',
        'Express',
        'TypeScript',
        'RapidAPI',
        'Vercel',
      ],
      P,
    ),
    features: fromSource(
      [
        'Instagram and YouTube media saving',
        'WhatsApp Status saving on Android via the Storage Access Framework',
        'Server-side API-key proxy (key never exposed to the client)',
        'Client-side direct download',
      ],
      P,
    ),
    links: fromSource(
      {
        live: 'https://build-it-ready.vercel.app/',
        code: 'https://github.com/23335a0504raju/stash-mobile',
        demo: 'https://expo.dev/accounts/raju_04/projects/stash/builds/adceea94-4078-4ae1-a833-baf630607a19',
      },
      P,
    ),
    image: img('stash.png'),
  },

  // ── Supporting (belt beacons → dossiers) ──────────────────────────────────
  {
    id: 'campus-colab',
    tier: 'dossier',
    name: fromSource('Campus Colab', [SRC.portfolio, SRC.hero]),
    summary: fromSource(
      'Collaborative platform connecting students across campuses for group projects, knowledge sharing and academic networking.',
      P,
    ),
    role: fromSource('Full-Stack Developer', P),
    stack: fromSource(['React', 'Django REST Framework', 'Vercel', 'Render'], P),
    features: unverified(
      [
        'Real-time collaboration tools',
        'Academic resource sharing',
        'Cross-institution networking',
      ],
      [SRC.portfolio, SRC.linkedinFeatured, SRC.driveReports],
      'LinkedIn Featured: "60+ users with real-time chat and role-based access". The project report (Unified Learning, Oct 2024) lists role-based access, posting and notifications, chat and group messaging. "Real-time" still to match the repository.',
    ),
    links: fromSource(
      {
        live: 'https://campus-colab.vercel.app/',
        code: 'https://github.com/23335a0504raju/CampusColab',
        demo: 'https://youtu.be/FJc1TvDGNC0',
        docs: 'https://drive.google.com/file/d/1wn1RrdDCIKBXLN264LbOwnjrlFUsLKKw/view',
      },
      P,
    ),
    image: img('campus.png'),
  },
  {
    id: 'smart-stock',
    tier: 'dossier',
    name: fromSource('Smart Stock Management', [SRC.portfolio, SRC.hero]),
    summary: fromSource(
      'Inventory management system with machine-learning stock predictions and automated reordering.',
      P,
    ),
    role: fromSource('Lead Developer & ML Engineer', P),
    stack: fromSource(['React', 'Django REST', 'TensorFlow.js', 'Vercel', 'Render'], P),
    features: fromSource(
      [
        'Demand forecasting with Linear Regression and Random Forest models trained on Kaggle datasets',
        'Automated low-stock alerts',
        'Interactive data visualisations',
      ],
      [SRC.resume2026, SRC.portfolio, SRC.driveReports],
      'The current resume names the models and says Random Forest beat the baseline by about 20%. Alerts and visualisations are from the old site.',
    ),
    links: fromSource(
      {
        live: 'https://inventory-pi-smoky.vercel.app/',
        code: 'https://github.com/23335a0504raju/Inventory',
        docs: 'https://drive.google.com/file/d/1cltbKexsiuCJuossKtMv0rqNoAEKe1bY/view',
      },
      P,
    ),
    image: img('inventory.png'),
  },
  {
    id: 'object-detection',
    tier: 'dossier',
    name: fromSource('Object Detection', P),
    summary: fromSource(
      'Upload an image and receive it annotated with bounding boxes, labels and confidence scores, using a lightweight YOLOv8 nano model.',
      P,
    ),
    role: fromSource('Full-Stack Developer', P),
    stack: fromSource(['React', 'Django REST', 'YOLOv8', 'Render'], P),
    features: fromSource(['Annotated image with bounding boxes, labels and confidence scores'], P),
    links: fromSource(
      {
        live: 'https://objectdetection-1-d5cq.onrender.com/',
        code: 'https://github.com/23335a0504raju/ObjectDetection',
      },
      P,
    ),
    image: img('object.png'),
  },
  {
    id: 'n8n-automation',
    tier: 'dossier',
    name: fromSource('n8n Automation', P),
    summary: fromSource(
      'WhatsApp-controlled Google Drive automation workflow built with n8n, deployed with Docker on Render and logging to Supabase PostgreSQL.',
      P,
    ),
    role: missing('Role', 'Source role field just says "N8n Automation". Provide your role.'),
    stack: fromSource(['n8n', 'JavaScript', 'Docker', 'Render', 'Supabase PostgreSQL'], P),
    features: fromSource(['WhatsApp-controlled Google Drive workflow', 'Supabase logging'], P),
    links: fromSource(
      {
        live: 'https://n8n-s63m.onrender.com/',
        code: 'https://github.com/23335a0504raju/n8nAutomation',
        demo: 'https://drive.google.com/file/d/1Q5h_LfxFWdYPsnuMbdHslReYP5F35UmO/view',
      },
      P,
    ),
    image: img('n8n.png'),
  },
  {
    id: 'codealpha-ecommerce',
    tier: 'dossier',
    name: fromSource('E-Commerce Platform', P),
    summary: fromSource(
      'Online shopping platform with secure payment processing and an admin dashboard.',
      P,
      'Source says "developed during internship" (CodeAlpha). Is this an internship to list under Experience? (Q4)',
    ),
    role: fromSource('Frontend Developer Intern', P),
    stack: fromSource(['React', 'Django REST', 'Stripe API', 'Vercel'], P),
    features: fromSource(['Secure payment processing', 'Admin dashboard analytics'], P),
    links: fromSource(
      {
        live: 'https://code-alpha-task-nu.vercel.app/',
        code: 'https://github.com/23335a0504raju/CodeAlpha_Task2',
      },
      P,
    ),
    image: img('codealpha.png'),
  },

  // ── Mission Brief only ────────────────────────────────────────────────────
  {
    id: 'travel-pool',
    tier: 'brief-only',
    name: fromSource('Travel Pool', P),
    summary: fromSource('Ride-sharing platform for travellers to connect and share journeys.', P),
    role: fromSource('Full-Stack Developer', P),
    stack: fromSource(['HTML5', 'CSS3', 'JavaScript', 'PHP', 'jQuery', 'Google Maps API'], P),
    features: fromSource(['Route matching', 'User ratings'], P),
    links: fromSource(
      {
        live: 'https://travelpool.infinityfreeapp.com/',
        code: 'https://github.com/23335a0504raju/Travel',
        demo: 'https://www.youtube.com/watch?v=GEq9HO3_ggI',
      },
      P,
    ),
    image: img('travel.png'),
  },
  {
    id: '4seed',
    tier: 'brief-only',
    name: fromSource('4 SEED: Farm Direct', P),
    summary: fromSource(
      'Direct-to-consumer agricultural marketplace connecting farmers and buyers.',
      P,
    ),
    role: fromSource('Frontend Developer', P),
    stack: fromSource(['HTML5', 'CSS3', 'JavaScript', 'PHP', 'jQuery', 'MySQL'], P),
    features: fromSource(['Farm produce marketplace', 'Direct farmer–consumer transactions'], P),
    links: fromSource(
      {
        live: 'http://4seed.infinityfreeapp.com/',
        code: 'https://github.com/23335a0504raju/4seed',
      },
      P,
    ),
    image: img('4seed.png'),
  },
  {
    id: 'fitness-tracker',
    tier: 'brief-only',
    name: fromSource('Fitness Tracker', P),
    summary: fromSource('Fitness website built for a hackathon.', P),
    role: fromSource('Full-Stack Developer', P),
    stack: fromSource(['HTML', 'Django', 'Stripe API'], P),
    features: fromSource(['Fitbit integration', 'Points and doctor appointments'], P),
    links: unverified(
      { live: 'https://naga.pythonanywhere.com/' },
      P,
      'Repository link in source points to the GitHub profile root, not a repository. Provide the repo URL.',
    ),
    image: img('fibit.png'),
  },

  // ── Excluded (kept for traceability; never rendered) ──────────────────────
  {
    id: 'navi-frontend',
    tier: 'excluded',
    name: fromSource('Navi FrontEnd', P),
    summary: fromSource('Frontend clone with smooth scrolling effects.', P),
    role: missing('Role', 'No role in source.'),
    stack: fromSource(['JavaScript', 'React', 'Vercel'], P),
    features: fromSource([], P),
    links: fromSource(
      {
        live: 'https://clone-task-one.vercel.app/',
        code: 'https://github.com/23335a0504raju/CloneTask',
      },
      P,
    ),
    image: img('image.png'),
  },
];
