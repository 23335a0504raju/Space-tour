import { confirmed, fromSource } from './fact.ts';
import { SRC } from './sources.ts';
import type { Education } from './types.ts';

export const education: readonly Education[] = [
  {
    id: 'btech',
    qualification: confirmed(
      'B.Tech in Computer Science and Engineering',
      [SRC.userAnswers, SRC.resume2026, SRC.driveReports],
      'Raju, 2026-11-24: no specialisation (the "AI & ML" of the old site is dropped).',
    ),
    institution: fromSource('MVGR College of Engineering', [
      SRC.resume,
      SRC.about,
      SRC.linkedinEducation,
    ]),
    period: fromSource({ start: 'Aug 2023', end: 'May 2026' }, [SRC.resume]),
    grade: confirmed(
      'CGPA 8.4 / 10',
      [SRC.userAnswers, SRC.linkedinEducation],
      'Raju, 2026-11-24: "8.4 is right" (the resume said 8.31, the old site 8.36).',
    ),
    placement: 'journey',
  },
  {
    id: 'diploma',
    qualification: fromSource('Diploma in Computer Engineering', [SRC.resume, SRC.about]),
    institution: confirmed(
      'Government Polytechnic, Rebaka (Anakapalli)',
      [SRC.userAnswers, SRC.resume, SRC.linkedinEducation],
      'Raju, 2026-11-24: "anakapalli, rebaka".',
    ),
    period: fromSource({ start: 'Aug 2020', end: 'May 2023' }, [SRC.resume]),
    grade: fromSource('83%', [SRC.resume, SRC.about, SRC.linkedinEducation]),
    placement: 'journey',
  },
  {
    id: 'secondary',
    qualification: fromSource('Secondary Education', [SRC.about, SRC.education]),
    institution: fromSource('Jubilee English Medium School', [SRC.about, SRC.education]),
    period: confirmed(
      { start: '2019', end: '2020' },
      [SRC.userAnswers, SRC.about],
      'Raju, 2026-11-24.',
    ),
    grade: fromSource('98%', [SRC.about]),
    placement: 'brief-only',
  },
];
