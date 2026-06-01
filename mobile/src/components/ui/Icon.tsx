import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';
import { colors } from '../../theme';

/**
 * He thong icon SVG (thay cho emoji). Stroke-based, dong bo phong cach voi web customer.
 * Tat ca icon dung viewBox 0 0 24 24, ve bang stroke = currentColor.
 */
export type IconName =
  | 'search'
  | 'check'
  | 'truck'
  | 'shield'
  | 'box'
  | 'card'
  | 'home'
  | 'cart'
  | 'basket'
  | 'package'
  | 'user'
  | 'arrow-right'
  | 'chevron-right'
  | 'chevron-left'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'warning'
  | 'block'
  | 'leaf'
  | 'star'
  | 'map-pin'
  | 'phone'
  | 'clock'
  | 'tag'
  | 'logout'
  | 'x'
  | 'plus-circle';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: IconProps) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, common, color)}
    </Svg>
  );
}

type CommonSvgProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
};

function renderPaths(name: IconName, c: CommonSvgProps, color: string) {
  switch (name) {
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={7} {...c} />
          <Path d="m20 20-3.5-3.5" {...c} />
        </>
      );
    case 'check':
      return <Path d="M20 6 9 17l-5-5" {...c} />;
    case 'truck':
      return (
        <>
          <Path d="M3 13l2-7h11l3 4h2v3" {...c} />
          <Circle cx={7} cy={17} r={2} {...c} />
          <Circle cx={17} cy={17} r={2} {...c} />
        </>
      );
    case 'shield':
      return (
        <>
          <Path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" {...c} />
          <Path d="m9 12 2 2 4-4" {...c} />
        </>
      );
    case 'box':
      return (
        <>
          <Path d="M4 4h16v4H4V4Z" {...c} />
          <Path d="M4 10h16v10H4V10Z" {...c} />
          <Line x1={8} y1={14} x2={16} y2={14} {...c} />
        </>
      );
    case 'card':
      return (
        <>
          <Rect x={2} y={6} width={20} height={12} rx={2} {...c} />
          <Line x1={2} y1={10} x2={22} y2={10} {...c} />
          <Line x1={6} y1={15} x2={10} y2={15} {...c} />
        </>
      );
    case 'home':
      return (
        <>
          <Path d="M3 11.5 12 4l9 7.5" {...c} />
          <Path d="M5 10v10h14V10" {...c} />
          <Path d="M10 20v-6h4v6" {...c} />
        </>
      );
    case 'cart':
      return (
        <>
          <Circle cx={9} cy={20} r={1.6} {...c} />
          <Circle cx={18} cy={20} r={1.6} {...c} />
          <Path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" {...c} />
        </>
      );
    case 'basket':
      return (
        <>
          <Path d="M5 10 12 3l7 7" {...c} />
          <Path d="M3 10h18l-1.4 9.2a1.5 1.5 0 0 1-1.5 1.3H5.9a1.5 1.5 0 0 1-1.5-1.3L3 10Z" {...c} />
          <Line x1={9} y1={14} x2={9} y2={17} {...c} />
          <Line x1={15} y1={14} x2={15} y2={17} {...c} />
        </>
      );
    case 'package':
      return (
        <>
          <Path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" {...c} />
          <Path d="M3 7l9 5 9-5" {...c} />
          <Line x1={12} y1={12} x2={12} y2={22} {...c} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8} r={4} {...c} />
          <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" {...c} />
        </>
      );
    case 'arrow-right':
      return (
        <>
          <Line x1={4} y1={12} x2={20} y2={12} {...c} />
          <Polyline points="14 6 20 12 14 18" {...c} />
        </>
      );
    case 'chevron-right':
      return <Polyline points="9 5 16 12 9 19" {...c} />;
    case 'chevron-left':
      return <Polyline points="15 5 8 12 15 19" {...c} />;
    case 'plus':
      return (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...c} />
          <Line x1={5} y1={12} x2={19} y2={12} {...c} />
        </>
      );
    case 'plus-circle':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...c} />
          <Line x1={12} y1={8} x2={12} y2={16} {...c} />
          <Line x1={8} y1={12} x2={16} y2={12} {...c} />
        </>
      );
    case 'minus':
      return <Line x1={5} y1={12} x2={19} y2={12} {...c} />;
    case 'trash':
      return (
        <>
          <Polyline points="3 6 5 6 21 6" {...c} />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...c} />
        </>
      );
    case 'warning':
      return (
        <>
          <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" {...c} />
          <Line x1={12} y1={9} x2={12} y2={13} {...c} />
          <Line x1={12} y1={17} x2={12.01} y2={17} {...c} />
        </>
      );
    case 'block':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...c} />
          <Line x1={5.6} y1={5.6} x2={18.4} y2={18.4} {...c} />
        </>
      );
    case 'leaf':
      return (
        <>
          <Path d="M11 20c-4 0-7-3-7-7 0-5 4-9 16-9 0 12-4 16-9 16Z" {...c} />
          <Path d="M9 16c2-4 5-6 9-7" {...c} />
        </>
      );
    case 'star':
      return (
        <Path
          d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"
          stroke={color}
          strokeWidth={c.strokeWidth}
          strokeLinejoin="round"
          fill={color}
        />
      );
    case 'map-pin':
      return (
        <>
          <Path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" {...c} />
          <Circle cx={12} cy={10} r={2.6} {...c} />
        </>
      );
    case 'phone':
      return (
        <Path
          d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"
          {...c}
        />
      );
    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...c} />
          <Polyline points="12 7 12 12 16 14" {...c} />
        </>
      );
    case 'tag':
      return (
        <>
          <Path d="M3 12V3h9l9 9-9 9-9-9Z" {...c} />
          <Circle cx={7.5} cy={7.5} r={1.4} {...c} />
        </>
      );
    case 'logout':
      return (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...c} />
          <Polyline points="16 17 21 12 16 7" {...c} />
          <Line x1={21} y1={12} x2={9} y2={12} {...c} />
        </>
      );
    case 'x':
      return (
        <>
          <Line x1={6} y1={6} x2={18} y2={18} {...c} />
          <Line x1={18} y1={6} x2={6} y2={18} {...c} />
        </>
      );
    default:
      return null;
  }
}
