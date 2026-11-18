import { content, isPublishable } from '../content/index.ts';
import type { Experience, Project, WorkProject } from '../content/index.ts';
import { ContactPanel } from '../ui/ContactPanel.tsx';
import { FactText, shouldShow } from '../ui/FactText.tsx';
import styles from './Brief.module.css';

const {
  identity,
  experience,
  education,
  strengths,
  stack,
  projects,
  certifications,
  achievements,
} = content;

const DEV = import.meta.env.DEV;

const LINK_LABELS = { live: 'Live', code: 'Code', demo: 'Demo', docs: 'Docs' } as const;

function Links({ links }: { links: Project['links'] | WorkProject['links'] }) {
  if (!shouldShow(links)) return null;
  const entries = Object.entries(links.value) as Array<[keyof typeof LINK_LABELS, string]>;
  if (entries.length === 0) return null;
  return (
    <ul className={styles.links}>
      {entries.map(([kind, href]) => (
        <li key={kind}>
          <a href={href} target="_blank" rel="noopener noreferrer">
            <FactText fact={links}>{LINK_LABELS[kind]}</FactText>
          </a>
        </li>
      ))}
    </ul>
  );
}

function WorkProjectCard({ project }: { project: WorkProject }) {
  // Templates (status "missing") are dev-only until Raju supplies the real details.
  if (!shouldShow(project.name)) return null;
  const isTemplate = !isPublishable(project.name);
  return (
    <li className={styles.workProject} data-template={isTemplate || undefined}>
      {isTemplate && DEV && <p className={styles.templateTag}>Template: details to be provided</p>}
      <h4>
        <FactText fact={project.name} />
      </h4>
      <p>
        <FactText fact={project.summary} />
      </p>
      {shouldShow(project.contribution) && (
        <ul className={styles.bullets}>
          {project.contribution.value.map((item) => (
            <li key={item}>
              <FactText fact={project.contribution}>{item}</FactText>
            </li>
          ))}
        </ul>
      )}
      {shouldShow(project.stack) && (
        <p className={styles.stackLine}>
          <FactText fact={project.stack}>{project.stack.value.join(' · ')}</FactText>
        </p>
      )}
      <Links links={project.links} />
    </li>
  );
}

function ExperienceEntry({ job }: { job: Experience }) {
  const visibleProjects = job.projects.filter((p) => shouldShow(p.name));
  return (
    <li className={styles.entry}>
      <div className={styles.entryHead}>
        <h3>
          <FactText fact={job.role} /> · <FactText fact={job.organisation} />
        </h3>
        <p className={styles.period}>
          <FactText fact={job.period}>
            {job.period.value.start} – {job.period.value.end}
          </FactText>
        </p>
      </div>
      <p>
        <FactText fact={job.summary} />
      </p>
      {visibleProjects.length > 0 && (
        <>
          <p className={styles.subhead}>Projects</p>
          <ul className={styles.workProjects}>
            {visibleProjects.map((p) => (
              <WorkProjectCard key={p.id} project={p} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

function ProjectCard({ project, large }: { project: Project; large?: boolean }) {
  return (
    <li className={large ? styles.projectLarge : styles.project}>
      <h3>
        <FactText fact={project.name} />
      </h3>
      <p className={styles.role}>
        <FactText fact={project.role} />
      </p>
      <p>
        <FactText fact={project.summary} />
      </p>
      {large && project.features.value.length > 0 && (
        <ul className={styles.bullets}>
          {project.features.value.map((f) => (
            <li key={f}>
              <FactText fact={project.features}>{f}</FactText>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.stackLine}>
        <FactText fact={project.stack}>{project.stack.value.join(' · ')}</FactText>
      </p>
      <Links links={project.links} />
    </li>
  );
}

export function Brief() {
  const flagships = projects.filter((p) => p.tier === 'diorama' || p.tier === 'architecture');
  const supporting = projects.filter((p) => p.tier === 'dossier');
  const more = projects.filter((p) => p.tier === 'brief-only');
  const visibleAchievements = achievements.filter(shouldShow);

  return (
    <>
      <a className="skip-link" href="#contact">
        Skip to contact
      </a>
      <header className={styles.header}>
        <p className={styles.kicker}>Mission Brief</p>
        <h1 className={styles.name}>
          <FactText fact={identity.name} />
        </h1>
        <p className={styles.roleLarge}>
          <FactText fact={identity.role} />
        </p>
        <p className={styles.summary}>
          <FactText fact={identity.summary} />
        </p>
        <nav aria-label="Sections" className={styles.toc}>
          <a href="#experience">Experience</a>
          <a href="#projects">Projects</a>
          <a href="#strengths">Strengths</a>
          <a href="#stack">Stack</a>
          <a href="#education">Education</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main className={styles.main}>
        <section id="experience" className={styles.section} aria-labelledby="experience-title">
          <h2 id="experience-title">Experience</h2>
          <ol className={styles.entries}>
            {experience.map((job) => (
              <ExperienceEntry key={job.id} job={job} />
            ))}
          </ol>
        </section>

        <section id="projects" className={styles.section} aria-labelledby="projects-title">
          <h2 id="projects-title">Projects</h2>
          <ul className={styles.projectGrid}>
            {flagships.map((p) => (
              <ProjectCard key={p.id} project={p} large />
            ))}
          </ul>
          <h3 className={styles.subhead}>More projects</h3>
          <ul className={styles.projectGrid}>
            {supporting.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
          <ul className={styles.compactList}>
            {more.map((p) => (
              <li key={p.id}>
                <strong>
                  <FactText fact={p.name} />
                </strong>{' '}
                · <FactText fact={p.summary} />
                <Links links={p.links} />
              </li>
            ))}
          </ul>
        </section>

        {shouldShow(strengths) && (
          <section id="strengths" className={styles.section} aria-labelledby="strengths-title">
            <h2 id="strengths-title">Core strengths</h2>
            <ul className={styles.bullets}>
              {strengths.value.map((s) => (
                <li key={s}>
                  <FactText fact={strengths}>{s}</FactText>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="stack" className={styles.section} aria-labelledby="stack-title">
          <h2 id="stack-title">Technology stack</h2>
          <dl className={styles.stack}>
            {stack.map((group) => (
              <div key={group.id}>
                <dt>{group.label}</dt>
                <dd>
                  <FactText fact={group.items}>{group.items.value.join(' · ')}</FactText>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="education" className={styles.section} aria-labelledby="education-title">
          <h2 id="education-title">Education</h2>
          <ol className={styles.entries}>
            {education.map((e) => (
              <li key={e.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <h3>
                    <FactText fact={e.qualification} />
                  </h3>
                  <p className={styles.period}>
                    <FactText fact={e.period}>
                      {e.period.value.start} – {e.period.value.end}
                    </FactText>
                  </p>
                </div>
                <p>
                  <FactText fact={e.institution} /> · <FactText fact={e.grade} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="certifications" className={styles.section} aria-labelledby="certs-title">
          <h2 id="certs-title">Certifications</h2>
          <ul className={styles.compactList}>
            {certifications.value.map((c) => (
              <li key={c.name}>
                <FactText fact={certifications}>
                  {c.name} · {c.issuer}, {c.year}
                </FactText>
              </li>
            ))}
          </ul>
          {visibleAchievements.length > 0 && (
            <>
              <h3 id="achievements" className={styles.subhead}>
                Achievements
              </h3>
              <ul className={styles.bullets}>
                {visibleAchievements.map((a) => (
                  <li key={a.value}>
                    <FactText fact={a} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section id="contact" className={styles.section}>
          <ContactPanel id="brief-contact" />
        </section>
      </main>

      <footer className={styles.footer}>
        <a href="/">Experience the mission</a>
      </footer>
    </>
  );
}
