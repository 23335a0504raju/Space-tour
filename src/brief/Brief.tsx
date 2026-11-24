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
  courses,
  achievements,
  learning,
  futureDirection,
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
      {job.responsibilities && shouldShow(job.responsibilities) && (
        <>
          <p className={styles.subhead}>Also owned</p>
          <ul className={styles.bullets}>
            {job.responsibilities.value.map((item) => (
              <li key={item}>
                <FactText fact={job.responsibilities!}>{item}</FactText>
              </li>
            ))}
          </ul>
        </>
      )}
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
      {job.lessons && shouldShow(job.lessons) && (
        <>
          <p className={styles.subhead}>What it taught me</p>
          <ul className={styles.bullets}>
            {job.lessons.value.map((item) => (
              <li key={item}>
                <FactText fact={job.lessons!}>{item}</FactText>
              </li>
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
        {shouldShow(identity.availability) && (
          <p className={styles.summary}>
            <FactText fact={identity.availability} />
          </p>
        )}
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
          {shouldShow(courses) && (
            <>
              <h3 className={styles.subhead}>Courses</h3>
              <ul className={styles.compactList}>
                {courses.value.map((c) => (
                  <li key={c.name}>
                    <FactText fact={courses}>
                      {c.name} · {c.issuer}, {c.year}
                    </FactText>
                  </li>
                ))}
              </ul>
            </>
          )}
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

        {(shouldShow(learning) || shouldShow(futureDirection)) && (
          <section id="direction" className={styles.section} aria-labelledby="direction-title">
            <h2 id="direction-title">What comes next</h2>
            {shouldShow(learning) && (
              <p>
                <strong>Learning now: </strong>
                <FactText fact={learning} />
              </p>
            )}
            {shouldShow(futureDirection) && (
              <p>
                <strong>Next: </strong>
                <FactText fact={futureDirection} />
              </p>
            )}
          </section>
        )}

        <section id="contact" className={styles.section}>
          <ContactPanel id="brief-contact" />
        </section>
      </main>

      <footer className={styles.footer}>
        <a href="/">Experience the mission</a>
        {/* CC BY credits (assets/ASSET_REGISTER.md); the full credits page is a P5 item */}
        <p className={styles.credits}>
          3D set: based on{' '}
          <a href="https://sketchfab.com/3d-models/sf-bridge-console-3fca908d15254573b0a8bbec7f3a8c05">
            “SF bridge console / 科幻風艦橋”
          </a>{' '}
          by <a href="https://sketchfab.com/hovce">林柏勳 (Lin)</a>, licensed under{' '}
          <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; modified.
        </p>
        <p className={styles.credits}>
          Launch platform: based on{' '}
          <a href="https://sketchfab.com/3d-models/sci-fi-hangar-4b263701219446f1ab13b37a5b98bac5">
            “SCI FI HANGAR”
          </a>{' '}
          by <a href="https://sketchfab.com/Lezalit">Lezalit</a>, licensed under{' '}
          <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; modified.
        </p>
        <p className={styles.credits}>
          Anime worlds: 3D models from Sketchfab, modified (simplified and recompressed), credited
          to their authors:
        </p>
        <ul className={styles.credits}>
          <li key="https://sketchfab.com/3d-models/naruto-shippuden-naruto-ea2e5dff481243b9973f2bb34a384031">
            <a href="https://sketchfab.com/3d-models/naruto-shippuden-naruto-ea2e5dff481243b9973f2bb34a384031">
              “Naruto Shippuden- Naruto”
            </a>{' '}
            by <a href="https://sketchfab.com/lopuh22721">#Anime resource!!!</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/ichiraku-ramen-naruto-c57a7c0bdca4446aade5241cc621f56e">
            <a href="https://sketchfab.com/3d-models/ichiraku-ramen-naruto-c57a7c0bdca4446aade5241cc621f56e">
              “Ichiraku Ramen (Naruto)”
            </a>{' '}
            by <a href="https://sketchfab.com/Doverlock">Doverlock</a>,{' '}
            <a href="http://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/death-note-17e2a68603464169b22ea5cdb8572f69">
            <a href="https://sketchfab.com/3d-models/death-note-17e2a68603464169b22ea5cdb8572f69">
              “Death note”
            </a>{' '}
            by <a href="https://sketchfab.com/XRUNFF">xRUN</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/ryuk-from-death-note-cf0ccb0310ea4bdd97122b6183e9e71b">
            <a href="https://sketchfab.com/3d-models/ryuk-from-death-note-cf0ccb0310ea4bdd97122b6183e9e71b">
              “Ryuk from Death Note”
            </a>{' '}
            by <a href="https://sketchfab.com/PotBin">PotBin</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/free-london-kinnaird-house-ff13d8c9407f4796886a689a758dc862">
            <a href="https://sketchfab.com/3d-models/free-london-kinnaird-house-ff13d8c9407f4796886a689a758dc862">
              “[FREE] London, Kinnaird House”
            </a>{' '}
            by <a href="https://sketchfab.com/99.Miles">99.Miles</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/tanjiro-kamado-from-demon-slayer-fully-rigged-0ab5b317b7654fd29255d22182537ded">
            <a href="https://sketchfab.com/3d-models/tanjiro-kamado-from-demon-slayer-fully-rigged-0ab5b317b7654fd29255d22182537ded">
              “Tanjiro Kamado from Demon Slayer - Fully Rigged”
            </a>{' '}
            by <a href="https://sketchfab.com/Light.k">Light.k</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/nezuko-kamado-demon-slayer-134a47bc3d2247d0a4dafc20fa037c53">
            <a href="https://sketchfab.com/3d-models/nezuko-kamado-demon-slayer-134a47bc3d2247d0a4dafc20fa037c53">
              “Nezuko Kamado-Demon Slayer”
            </a>{' '}
            by <a href="https://sketchfab.com/atharvaj365">Atharva Jagtap</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/blossom-katana-6cff8d381e2948ef9527d3d99e80520c">
            <a href="https://sketchfab.com/3d-models/blossom-katana-6cff8d381e2948ef9527d3d99e80520c">
              “Blossom Katana”
            </a>{' '}
            by <a href="https://sketchfab.com/MitchellBekke">Mitchell Bekke</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/low-poly-farm-v2-0e91a96ca6ee44569cf94972e30b5be4">
            <a href="https://sketchfab.com/3d-models/low-poly-farm-v2-0e91a96ca6ee44569cf94972e30b5be4">
              “Low Poly Farm V2”
            </a>{' '}
            by <a href="https://sketchfab.com/Edwin3D">EdwinRC</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/west-street-f5e530d7fe6b47f58c35fdf2a90cfb21">
            <a href="https://sketchfab.com/3d-models/west-street-f5e530d7fe6b47f58c35fdf2a90cfb21">
              “West street”
            </a>{' '}
            by <a href="https://sketchfab.com/Pasha.">Pasha</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
          <li key="https://sketchfab.com/3d-models/rural-buildings-set-low-poly-models-51ab7e74bac347a89725f1d22b928edf">
            <a href="https://sketchfab.com/3d-models/rural-buildings-set-low-poly-models-51ab7e74bac347a89725f1d22b928edf">
              “Rural Buildings Set - Low Poly models”
            </a>{' '}
            by <a href="https://sketchfab.com/DanielZhabotinsky">Daniel Zhabotinsky</a>,{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </li>
        </ul>
      </footer>
    </>
  );
}
