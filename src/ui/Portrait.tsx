import { content } from '../content/index.ts';
import { shouldShow } from './FactText.tsx';

const { identity } = content;

/** Raju's photo, from the content module; the host sizes and frames it. */
export function Portrait({ className }: { readonly className: string | undefined }) {
  if (!shouldShow(identity.portrait)) return null;
  return (
    <img
      className={className}
      src={identity.portrait.value}
      alt={`Portrait of ${identity.name.value}`}
      width={400}
      height={400}
      decoding="async"
    />
  );
}
