import gsap from 'gsap';

/**
 * Cinematic entrance for a chapter card: one paused GSAP timeline per panel, seeked by the Director
 * from the panel's scroll-driven visibility (0..1). Because nothing plays on a clock, the sequence is
 * a pure function of scroll progress: it reverses exactly, never lags behind the scroll, and needs
 * no React state. Order (power3.out throughout):
 *   card (rise + clip) → kicker (tracking settles) → heading (masked rise) → body → list items
 *   (staggered) → actions (last, slight scale).
 * Elements are classified by structure, so every card variant (and ContactPanel) gets the same
 * choreography without per-card code.
 */
export interface Reveal {
  progress(p: number): unknown;
}

const CTA = 'button, a[class*="bay"], a[class*="ghost"], a[class*="button"]';

interface Parts {
  kicker: HTMLElement[];
  heading: HTMLElement[];
  body: HTMLElement[];
  items: HTMLElement[];
  cta: HTMLElement[];
}

function classify(node: HTMLElement, parts: Parts): void {
  for (const child of Array.from(node.children) as HTMLElement[]) {
    const tag = child.tagName;
    const cls = child.className.toString();
    if (cls.includes('kicker')) parts.kicker.push(child);
    else if (tag === 'H2' || tag === 'H3') parts.heading.push(child);
    else if (tag === 'UL' || tag === 'OL')
      parts.items.push(...(Array.from(child.children) as HTMLElement[]));
    else if (tag === 'DL') parts.items.push(...(Array.from(child.children) as HTMLElement[]));
    else if (child.matches(CTA)) parts.cta.push(child);
    else if (tag === 'P' && child.querySelector(CTA))
      parts.cta.push(...(Array.from(child.querySelectorAll(CTA)) as HTMLElement[]));
    else if (
      (tag === 'DIV' || tag === 'SECTION') &&
      child.children.length > 0 &&
      !cls.includes('visually-hidden')
    )
      classify(child, parts);
    else if (!cls.includes('visually-hidden')) parts.body.push(child);
  }
}

export function buildReveal(
  el: HTMLElement,
  /** `plain`: only the card itself rises and fades (its parts have their own motion) */
  opts: { editorial: boolean; reduced: boolean; plain?: boolean },
): Reveal {
  const parts: Parts = { kicker: [], heading: [], body: [], items: [], cta: [] };
  if (!opts.plain) classify(el, parts);
  const move = opts.reduced ? 0 : 1;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

  // 1 · card: rises into place; boxed cards open with a short clip from the bottom edge. The
  // editorial intro has no box (its vignette extends past the panel), so it only rises and fades.
  tl.fromTo(
    el,
    {
      opacity: 0,
      y: 28 * move,
      clipPath: opts.editorial || opts.reduced ? 'none' : 'inset(0% 0% 18% 0% round 6px)',
    },
    {
      opacity: 1,
      y: 0,
      clipPath: opts.editorial || opts.reduced ? 'none' : 'inset(0% 0% 0% 0% round 6px)',
      duration: 0.65,
    },
    0,
  );
  // 2 · kicker: small rise, tracking settles from wide to its resting value
  if (parts.kicker.length)
    tl.fromTo(
      parts.kicker,
      { opacity: 0, y: 8 * move, letterSpacing: opts.reduced ? '0.16em' : '0.32em' },
      { opacity: 1, y: 0, letterSpacing: '0.16em', duration: 0.5 },
      0.16,
    );
  // 3 · heading: masked reveal, the line rises out from behind its own lower edge
  if (parts.heading.length)
    tl.fromTo(
      parts.heading,
      { opacity: 0, y: 20 * move, clipPath: opts.reduced ? 'none' : 'inset(0% 0% 100% 0%)' },
      {
        opacity: 1,
        y: 0,
        clipPath: opts.reduced ? 'none' : 'inset(-10% -2% -25% -2%)',
        duration: 0.6,
        stagger: 0.08,
      },
      0.26,
    );
  // 4 · description and media
  if (parts.body.length)
    tl.fromTo(
      parts.body,
      { opacity: 0, y: 12 * move },
      { opacity: 1, y: 0, duration: 0.55, stagger: 0.06 },
      0.42,
    );
  // 5 · list items, one after another
  if (parts.items.length)
    tl.fromTo(
      parts.items,
      { opacity: 0, y: 10 * move },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.08 },
      0.5,
    );
  // 6 · actions last
  if (parts.cta.length)
    tl.fromTo(
      parts.cta,
      { opacity: 0, scale: opts.reduced ? 1 : 0.96 },
      { opacity: 1, scale: 1, duration: 0.45, stagger: 0.06 },
      `>-0.25`,
    );
  tl.progress(0);
  return tl;
}
