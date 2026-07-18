import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import './scroll-reveal.css';

type RevealVariant = 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';

interface ScrollRevealProps {
  children: ReactNode;
  /** Animation direction / style when entering viewport */
  variant?: RevealVariant;
  /** Delay in ms (stagger sibling cards) */
  delay?: number;
  /** Root margin for IntersectionObserver */
  rootMargin?: string;
  /** Threshold 0–1 */
  threshold?: number;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
  /** If true, only animate once (default false = replay on scroll back) */
  once?: boolean;
}

/**
 * Scroll-triggered enter/leave reveal.
 * - In view: jumps/fades in
 * - Out of view: resets so scrolling back animates again
 */
export function ScrollReveal({
  children,
  variant = 'up',
  delay = 0,
  rootMargin = '0px 0px -10% 0px',
  threshold = 0.15,
  className = '',
  as: Tag = 'div',
  style,
  once = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.classList.add('is-revealed');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-revealed');
          el.classList.remove('is-leaving');
          if (once) observer.unobserve(el);
        } else if (!once) {
          // Leaving viewport — soft exit so re-enter can play again
          if (el.classList.contains('is-revealed')) {
            el.classList.add('is-leaving');
          }
          el.classList.remove('is-revealed');
        }
      },
      { root: null, rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  const Component = Tag;

  return (
    <Component
      ref={ref as never}
      className={`scroll-reveal scroll-reveal--${variant}${className ? ` ${className}` : ''}`}
      style={{
        ...style,
        ['--reveal-delay' as string]: `${delay}ms`,
      }}
    >
      {children}
    </Component>
  );
}
