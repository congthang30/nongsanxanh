import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import './page-transition.css';

const EXIT_MS = 180;
const ENTER_MS = 320;

/**
 * Smooth enter/leave for nested routes (dashboard + storefront).
 * Keeps previous page visible while playing exit, then mounts next with enter.
 */
export function PageTransition({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const outlet = useOutlet();
  const content = children ?? outlet;

  const pathRef = useRef(location.pathname + location.search);
  const contentRef = useRef(content);
  contentRef.current = content;

  const [displayKey, setDisplayKey] = useState(pathRef.current);
  const [displayNode, setDisplayNode] = useState<ReactNode>(content);
  const [phase, setPhase] = useState<'enter' | 'exit' | 'idle'>('enter');

  useEffect(() => {
    const nextKey = location.pathname + location.search;
    if (nextKey === pathRef.current) {
      setDisplayNode(contentRef.current);
      return;
    }

    setPhase('exit');
    const exitTimer = window.setTimeout(() => {
      pathRef.current = nextKey;
      setDisplayKey(nextKey);
      setDisplayNode(contentRef.current);
      setPhase('enter');
    }, EXIT_MS);

    return () => window.clearTimeout(exitTimer);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (phase !== 'enter') return;
    const enterTimer = window.setTimeout(() => setPhase('idle'), ENTER_MS);
    return () => window.clearTimeout(enterTimer);
  }, [phase, displayKey]);

  return (
    <div
      key={displayKey}
      className={
        'page-transition' +
        (phase === 'enter' ? ' page-transition--enter' : '') +
        (phase === 'exit' ? ' page-transition--exit' : '') +
        (phase === 'idle' ? ' page-transition--idle' : '')
      }
    >
      {displayNode}
    </div>
  );
}
