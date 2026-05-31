import { SVGProps } from 'react';

/**
 * Bo icon SVG dung chung cho header / dashboard.
 * Tat ca dung currentColor de ke thua mau theo theme.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function CartIcon({ size = 22, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M3 4h2.4l2.2 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BellIcon({ size = 22, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4.6 1.5 6 1.5 6h-15S6 13.6 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function LeafIcon({ size = 22, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M11 20A8 8 0 0 1 3 12c0-4.4 3.6-8 8-8h8v8a8 8 0 0 1-8 8Z" />
      <path d="M3 21c4.5-4.5 9.5-7 16-9" />
    </svg>
  );
}

export function UserIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
