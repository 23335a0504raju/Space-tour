import { conflict, fromSource } from './fact.ts';
import { SRC } from './sources.ts';
import type { Education } from './types.ts';

export const education: readonly Education[] = [
  {
    id: 'btech',
    qualification: conflict(
      'B.Tech in Computer Science and Engineering',
      [SRC.resume, SRC.about, SRC.education],
      'About/Education pages mention an "AI & ML" specialisation; resume does not. Confirm (Q2).',
    ),
    institution: fromSource('MVGR College of Engineering', [SRC.resume, SRC.about]),
    period: fromSource({ start: 'Aug 2023', end: 'May 2026' }, [SRC.resume]),
    grade: conflict(
      'CGPA 8.31 / 10',
      [SRC.resume, SRC.about, SRC.portfolio],
      'Resume says 8.31; About and Portfolio say 8.36. Confirm (Q2).',
    ),
    placement: 'journey',
  },
  {
    id: 'diploma',
    qualification: fromSource('Diploma in Computer Engineering', [SRC.resume, SRC.about]),
    institution: fromSource('Government Polytechnic, Anakapalli', [SRC.resume, SRC.about]),
    period: fromSource({ start: 'Aug 2020', end: 'May 2023' }, [SRC.resume]),
    grade: fromSource('83%', [SRC.resume, SRC.about]),
    placement: 'journey',
  },
  {
    id: 'secondary',
    qualification: fromSource('Secondary Education', [SRC.about, SRC.education]),
    institution: fromSource('Jubilee English Medium School', [SRC.about, SRC.education]),
    period: fromSource({ start: '2019', end: '2020' }, [SRC.about]),
    grade: fromSource('98%', [SRC.about]),
    placement: 'brief-only',
  },
];
