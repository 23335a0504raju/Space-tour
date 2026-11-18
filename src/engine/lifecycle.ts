import { useEffect, useRef } from 'react';

interface Disposable {
  dispose(): void;
}

/**
 * Dispose GPU resources (materials, geometries, textures) created in `useMemo` when the component
 * really unmounts.
 *
 * StrictMode (dev) runs effect cleanups and then the effects again immediately, with the same
 * memoised objects. Disposing right away freed resources that were still in use: the shader
 * precompile then queried deleted programs (`GL_INVALID_VALUE: glGetProgramiv`), and actions
 * crashed (P4). Here the cleanup schedules disposal for the next task, and a re-run cancels it.
 */
export function useDisposeOnUnmount(...items: ReadonlyArray<Disposable | null | undefined>): void {
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (pending.current !== undefined) {
      clearTimeout(pending.current);
      pending.current = undefined;
    }
    return () => {
      pending.current = setTimeout(() => {
        pending.current = undefined;
        for (const item of items) item?.dispose();
      }, 0);
    };
    // the items themselves are the dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, items);
}
