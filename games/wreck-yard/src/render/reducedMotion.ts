import { useEffect, useRef, type MutableRefObject } from 'react';

/** A ref that follows the system "reduce motion" setting. Frame loops read it without a re-render. */
export function useReducedMotionRef(): MutableRefObject<boolean> {
  const reduced = useRef(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const follow = () => { reduced.current = query.matches; };
    follow();
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);
  return reduced;
}
