import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '../styles/base.css';
import { Brief } from './Brief.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Mission Brief: #root missing');

const app = (
  <StrictMode>
    <Brief />
  </StrictMode>
);

// Production: the HTML is prerendered at build time, so hydrate it. Dev server: render fresh.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
