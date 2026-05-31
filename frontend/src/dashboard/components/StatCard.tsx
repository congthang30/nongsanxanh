interface Props {
  icon: string;
  label: string;
  value: number | string;
  delta?: { value: number; positive?: boolean };
  color?: string;
  /** Format value cho number; ignore neu value la string. */
  format?: (n: number) => string;
}

export function StatCard({
  icon,
  label,
  value,
  delta,
  color = '#22c55e',
  format,
}: Props) {
  const display =
    typeof value === 'number' && format ? format(value) : String(value);
  return (
    <div
      className="dash-stat"
      style={{ ['--dash-stat-color' as any]: color }}
    >
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-body">
        <div className="dash-stat-value">{display}</div>
        <div className="dash-stat-label">{label}</div>
        {delta && (
          <div className={`dash-stat-delta ${delta.positive ? 'up' : 'down'}`}>
            {delta.positive ? '▲' : '▼'} {Math.abs(delta.value).toFixed(1)}%
            <span className="muted" style={{ marginLeft: 4, fontWeight: 400 }}>
              vs ky truoc
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
