import { ReactNode, useState } from 'react';

export type ChartPeriod = 'day' | 'month' | 'year';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  period?: ChartPeriod;
  onPeriodChange?: (p: ChartPeriod) => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  period,
  onPeriodChange,
  actions,
  children,
}: ChartCardProps) {
  return (
    <div className="dash-chart">
      <div className="dash-chart-head">
        <div>
          <h3>{title}</h3>
          {subtitle && (
            <div className="muted" style={{ fontSize: 12 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
          {period && onPeriodChange && (
            <div className="dash-chart-tabs">
              {(['day', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  className={`dash-chart-tab ${
                    period === p ? 'active' : ''
                  }`}
                  onClick={() => onPeriodChange(p)}
                >
                  {p === 'day' ? 'Ngày' : p === 'month' ? 'Tháng' : 'Năm'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ==================== LINE CHART (SVG) ==================== */

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}

export function LineChart({
  data,
  color = '#22c55e',
  height = 220,
  format = (n) => n.toLocaleString('vi-VN'),
}: LineChartProps) {
  if (!data.length) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 13,
        }}
      >
        Chưa có dữ liệu
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const padding = { top: 16, right: 16, bottom: 28, left: 50 };
  const w = 800;
  const h = height;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const yScale = (v: number) =>
    innerH - ((v - min) / (max - min || 1)) * innerH;

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + yScale(d.value),
    ...d,
  }));

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Area fill path
  const areaPath = `${path} L ${points[points.length - 1].x} ${
    padding.top + innerH
  } L ${points[0].x} ${padding.top + innerH} Z`;

  // Y-axis ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = min + ((max - min) * i) / ticks;
    return { value, y: padding.top + yScale(value) };
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label="Biểu đồ"
    >
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            x2={w - padding.right}
            y1={t.y}
            y2={t.y}
            stroke="#e2e8f0"
            strokeDasharray="2 4"
          />
          <text
            x={padding.left - 8}
            y={t.y + 4}
            textAnchor="end"
            fontSize="11"
            fill="#94a3b8"
          >
            {format(t.value)}
          </text>
        </g>
      ))}
      {/* X labels */}
      {points
        .filter((_, i) => i % Math.max(1, Math.ceil(points.length / 8)) === 0)
        .map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={h - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#94a3b8"
          >
            {p.label}
          </text>
        ))}
      <path d={areaPath} fill="url(#lc-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="white"
          stroke={color}
          strokeWidth="2"
        >
          <title>
            {p.label}: {format(p.value)}
          </title>
        </circle>
      ))}
    </svg>
  );
}

/* ==================== BAR CHART (SVG) ==================== */

interface BarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}

export function BarChart({
  data,
  color = '#3b82f6',
  height = 220,
  format = (n) => n.toLocaleString('vi-VN'),
}: BarChartProps) {
  if (!data.length) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 13,
        }}
      >
        Chưa có dữ liệu
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const padding = { top: 16, right: 16, bottom: 28, left: 50 };
  const w = 800;
  const h = height;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const barW = (innerW / data.length) * 0.6;
  const gap = (innerW / data.length) * 0.4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={padding.left}
          x2={w - padding.right}
          y1={padding.top + innerH * (1 - p)}
          y2={padding.top + innerH * (1 - p)}
          stroke="#e2e8f0"
          strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const bh = (d.value / max) * innerH;
        const x = padding.left + i * (barW + gap) + gap / 2;
        const y = padding.top + innerH - bh;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              fill={color}
              rx="4"
              opacity="0.85"
            >
              <title>
                {d.label}: {format(d.value)}
              </title>
            </rect>
            <text
              x={x + barW / 2}
              y={h - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#94a3b8"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
