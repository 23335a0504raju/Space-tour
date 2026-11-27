import type { ReactNode } from 'react';
import styles from './titles.module.css';

/**
 * The floating title that opens each SC11 world, so a visitor knows which series they are flying
 * through (Raju, 2026-11-27), in flight order. Original lettering drawn here in SVG from the
 * site's own and the system's fonts: no official logo artwork is shipped. Real DOM text, timed by
 * the Director like any card (a pure function of scroll); the idle float is ambient CSS.
 */
export interface WorldTitle {
  readonly index: number;
  /** the series' name, as read by assistive tech */
  readonly name: string;
  /** the chapter's own theme */
  readonly theme: string;
  readonly mark: () => ReactNode;
}

const KANA = "'Yu Gothic', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'MS Gothic', sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
const HEAVY = "'Inter Variable', Inter, 'Arial Black', sans-serif";

/** Depth: the same lettering repeated down and to the right, behind the face. */
const extrude = (steps: number, dx: number, dy: number, draw: (k: number) => ReactNode) =>
  Array.from({ length: steps }, (_, i) => steps - i).map((k) => (
    <g key={k} transform={`translate(${k * dx} ${k * dy})`}>
      {draw(k)}
    </g>
  ));

/** Roughens edges like brush or worn print. */
function Rough({ id, freq, scale }: { id: string; freq: number; scale: number }) {
  return (
    <filter id={id} x="-10%" y="-20%" width="120%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="2" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" />
    </filter>
  );
}

/** Orange-to-gold block capitals leaning forward, with deep navy sides and a leaf-wind swirl. */
function VillageMark() {
  const word = (props: object) => (
    <text
      x="300"
      y="150"
      textAnchor="middle"
      textLength="500"
      lengthAdjust="spacingAndGlyphs"
      fontFamily={HEAVY}
      fontWeight="900"
      fontSize="128"
      {...props}
    >
      NARUTO
    </text>
  );
  return (
    <svg viewBox="0 0 600 230" aria-hidden="true">
      <defs>
        <linearGradient id="title-leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.1" stopColor="#ffe259" />
          <stop offset="0.55" stopColor="#ff9a1f" />
          <stop offset="0.95" stopColor="#e8401c" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#e9548f" strokeLinecap="round">
        <path d="M120 62C250 6 470 8 545 60" strokeWidth="11" opacity="0.9" />
        <path d="M62 172C130 222 340 214 452 172" strokeWidth="8" opacity="0.85" />
      </g>
      <g transform="skewX(-9) translate(24 0)">
        {extrude(9, 1.2, 1.5, () => word({ fill: '#14214f', stroke: '#14214f', strokeWidth: 9 }))}
        {word({ fill: '#14214f', stroke: '#14214f', strokeWidth: 12, strokeLinejoin: 'round' })}
        {word({ fill: '#fff', stroke: '#fff', strokeWidth: 5, strokeLinejoin: 'round' })}
        {word({ fill: 'url(#title-leaf)' })}
      </g>
      <text
        x="448"
        y="207"
        textAnchor="middle"
        fontFamily={KANA}
        fontWeight="700"
        fontSize="38"
        fill="#d5121f"
        stroke="#fff"
        strokeWidth="6"
        paintOrder="stroke"
      >
        ナルト
      </text>
    </svg>
  );
}

/** Worn black gothic capitals with a pale edge over a long blade of ink. */
function NotebookMark() {
  const word = (props: object) => (
    <text
      x="300"
      y="122"
      textAnchor="middle"
      textLength="540"
      lengthAdjust="spacingAndGlyphs"
      fontFamily={SERIF}
      fontWeight="700"
      fontSize="104"
      {...props}
    >
      DEATH NOTE
    </text>
  );
  return (
    <svg viewBox="0 0 600 220" aria-hidden="true">
      <defs>
        <Rough id="title-worn" freq={0.09} scale={5} />
      </defs>
      <g filter="url(#title-worn)">
        {extrude(7, 0.9, 1.4, () => word({ fill: '#3a0d14', stroke: '#3a0d14', strokeWidth: 5 }))}
        {word({ fill: '#f4f1ea', stroke: '#f4f1ea', strokeWidth: 8, strokeLinejoin: 'round' })}
        {word({ fill: '#0b0a0d' })}
        <path d="M22 164L190 152H410L578 164L410 178H190Z" fill="#0b0a0d" />
      </g>
      <text
        x="300"
        y="177"
        textAnchor="middle"
        fontFamily={KANA}
        fontWeight="700"
        fontSize="32"
        letterSpacing="6"
        fill="#fff"
      >
        デスノート
      </text>
    </svg>
  );
}

/** Ink capitals in two lines inside a red and black brush ring. */
function SlayerMark() {
  const line = (text: string, y: number, width: number, props: object) => (
    <text
      x="260"
      y={y}
      textAnchor="middle"
      textLength={width}
      lengthAdjust="spacingAndGlyphs"
      fontFamily={SERIF}
      fontWeight="700"
      fontSize="104"
      {...props}
    >
      {text}
    </text>
  );
  const both = (props: object) => (
    <>
      {line('DEMON', 188, 370, props)}
      {line('SLAYER', 290, 420, props)}
    </>
  );
  return (
    <svg viewBox="0 0 520 440" aria-hidden="true">
      <defs>
        <Rough id="title-brush" freq={0.045} scale={13} />
        <Rough id="title-ink" freq={0.08} scale={6} />
      </defs>
      <g filter="url(#title-brush)">
        <circle cx="260" cy="220" r="168" fill="#fbf7f0" opacity="0.92" />
        {/* the stroke: thick red at the foot and right, thinning to its tail */}
        <path
          d="M118 82C190 14 330 4 408 78C486 152 492 286 410 364C330 440 188 440 112 362C196 408 322 410 392 340C458 272 456 160 388 100C318 38 200 34 118 82Z"
          fill="#e3101d"
        />
        <path
          d="M140 100C210 48 320 44 384 104C450 168 452 270 390 336C322 404 214 408 132 362C214 386 308 382 368 322C424 264 424 176 368 122C308 68 214 62 140 100Z"
          fill="#120a0a"
        />
      </g>
      <g filter="url(#title-ink)">
        {extrude(6, 1, 1.5, () => both({ fill: '#8c0b12', stroke: '#8c0b12', strokeWidth: 9 }))}
        {both({ fill: '#fff', stroke: '#fff', strokeWidth: 10, strokeLinejoin: 'round' })}
        {both({ fill: '#14100f' })}
      </g>
      <text
        x="260"
        y="340"
        textAnchor="middle"
        fontFamily={HEAVY}
        fontWeight="700"
        fontSize="22"
        letterSpacing="3"
        fill="#14100f"
        stroke="#fbf7f0"
        strokeWidth="6"
        paintOrder="stroke"
      >
        KIMETSU NO YAIBA
      </text>
    </svg>
  );
}

export const WORLD_TITLES = {
  'sc11a-discipline': { index: 1, name: 'Naruto', theme: 'Discipline', mark: VillageMark },
  'sc11b-proof': { index: 2, name: 'Death Note', theme: 'Proof', mark: NotebookMark },
  'sc11c-horizon': { index: 3, name: 'Demon Slayer', theme: 'Horizon', mark: SlayerMark },
} as const satisfies Record<string, WorldTitle>;

export function WorldTitleCard({ title }: { title: WorldTitle }) {
  const total = Object.keys(WORLD_TITLES).length;
  const Mark = title.mark;
  return (
    <div className={styles.stage}>
      <div className={styles.turn}>
        <div className={styles.float}>
          <p className={styles.order}>
            World {title.index} of {total} · {title.theme}
          </p>
          <h2 className={`${styles.mark} ${title.index === 3 ? styles.tall : ''}`}>
            <span className="visually-hidden">{title.name}</span>
            <Mark />
          </h2>
        </div>
      </div>
    </div>
  );
}
