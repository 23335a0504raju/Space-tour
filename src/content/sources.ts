/** Evidence locations in the existing (read-only) portfolio, relative to c:\projects. */
const C = 'MainPortfolio/port/src/components';

export const SRC = {
  resume: `${C}/ResumeNew.jsx`,
  portfolio: `${C}/Portfolio.jsx`,
  hero: `${C}/Hero.jsx`,
  about: `${C}/About.jsx`,
  education: `${C}/Education.jsx`,
  contact: `${C}/Contact.jsx`,
  connect: `${C}/Connect.jsx`,
  footer: `${C}/Footer.jsx`,
  images: 'MainPortfolio/port/public/image',
  userBatch1: 'Batch 1 brief (user message)',
  userBatch3: 'Batch 3 / P0 instruction (user message)',
  userP4Sc06: 'P4 SC06 gate: user chose all five proposed strengths (2026-11-17)',
  /** The current resume Raju supplied (2026-11-24), shipped as public/resume.pdf. */
  resume2026:
    'Resume "Raju_Chowdavada_Full_stack.pdf" (supplied by Raju 2026-11-24; public/resume.pdf)',
  /** Raju's answers to the open decisions, in session (2026-11-24). */
  userAnswers: 'Raju, session 2026-11-24: answers to the ten open decisions',
  /** Raju's own account of his Spotmies work, in session (2026-11-24). */
  userSpotmies: 'Raju, session 2026-11-24: Spotmies projects and responsibilities',
  // LinkedIn, read-only, 2026-11-24 (Claude in Chrome; text copied verbatim, pasted by Raju)
  linkedin:
    'LinkedIn profile https://www.linkedin.com/in/rajuchowdavada/ (About, headline; read 2026-11-24)',
  linkedinExperience:
    'LinkedIn https://www.linkedin.com/in/rajuchowdavada/details/experience/ (read 2026-11-24)',
  linkedinEducation:
    'LinkedIn https://www.linkedin.com/in/rajuchowdavada/details/education/ (read 2026-11-24)',
  linkedinCertifications:
    'LinkedIn https://www.linkedin.com/in/rajuchowdavada/details/certifications/ (read 2026-11-24)',
  linkedinFeatured:
    'LinkedIn https://www.linkedin.com/in/rajuchowdavada/details/featured/ (read 2026-11-24)',
  postSpotmiesLessons:
    'LinkedIn post https://www.linkedin.com/feed/update/urn:li:activity:7466002320707993601/ (Spotmies lessons)',
  postStash:
    'LinkedIn post https://www.linkedin.com/feed/update/urn:li:activity:7466824561037348864/',
  postSmartWay:
    'LinkedIn post https://www.linkedin.com/feed/update/urn:li:activity:7444423290326065152/',
  postAgenticRag:
    'LinkedIn post https://www.linkedin.com/feed/update/urn:li:activity:7503036867475558401/',
  postCourses:
    'LinkedIn activity https://www.linkedin.com/in/raju-chowdavada-06b734347/recent-activity/all/ (Udemy certificates; ages relative to 2026-11-24)',
  leetcode: 'LeetCode https://leetcode.com/u/Raju_Ch8464/ (read 2026-11-24)',
  driveReports:
    'Google Drive files 1cltbKex… ("Mini Project 1A.docx.pdf") and 1wn1RrdD… ("PBLBatch_13 (1).pdf"), read 2026-11-24',
} as const;
