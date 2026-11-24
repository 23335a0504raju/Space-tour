import { conflict, fromSource } from './fact.ts';
import { SRC } from './sources.ts';
import type { Education } from './types.ts';

export const education: readonly Education[] = [
  {
    id: 'btech',
    qualification: conflict(
      'B.Tech in Computer Science and Engineering',
      [SRC.resume, SRC.about, SRC.education, SRC.driveReports],
      'About/Education pages mention an "AI & ML" specialisation; the resume, LinkedIn and both college project reports ("Bachelor of Technology in Computer Science and Engineering") do not. Confirm (Q2).',
    ),
    institution: fromSource('MVGR College of Engineering', [
      SRC.resume,
      SRC.about,
      SRC.linkedinEducation,
    ]),
    period: fromSource({ start: 'Aug 2023', end: 'May 2026' }, [SRC.resume]),
    grade: conflict(
      'CGPA 8.4 / 10',
      [SRC.linkedinEducation, SRC.resume, SRC.about, SRC.portfolio],
      'Three values: LinkedIn (newest, 2026-11-24) "Grade: 8.4"; resume 8.31; About and Portfolio 8.36. Showing the LinkedIn value until you confirm the final CGPA (Q2).',
    ),
    placement: 'journey',
  },
  {
    id: 'diploma',
    qualification: fromSource('Diploma in Computer Engineering', [SRC.resume, SRC.about]),
    institution: fromSource(
      'Government Polytechnic, Anakapalli',
      [SRC.resume, SRC.about, SRC.linkedinEducation],
      'LinkedIn names it "Government polytechnic Rebaka". Which name should the site use?',
    ),
    period: fromSource({ start: 'Aug 2020', end: 'May 2023' }, [SRC.resume]),
    grade: fromSource('83%', [SRC.resume, SRC.about, SRC.linkedinEducation]),
    placement: 'journey',
  },
  {
    id: 'secondary',
    qualification: fromSource('Secondary Education', [SRC.about, SRC.education]),
    institution: fromSource('Jubilee English Medium School', [SRC.about, SRC.education]),
    period: conflict(
      { start: '2019', end: '2020' },
      [SRC.about, SRC.linkedinEducation],
      'About: 2019–2020. LinkedIn: "Dec 2020 – Jan 2021". Confirm.',
    ),
    grade: fromSource('98%', [SRC.about]),
    placement: 'brief-only',
  },
];
