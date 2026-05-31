import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PlannedItem {
  label: string;
  desc: string;
}
interface Props {
  title: string;
  subtitle: string;
  /** Trang thai hien tai cua module trong MVP */
  statusNote: string;
  planned: PlannedItem[];
  /** CTA chinh dieu huong toi feature da co */
  cta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  children?: ReactNode;
}

/**
 * Placeholder chuan MVP cho cac module chua co API day du.
 * Khong dung "Coming soon" trong: neu ro trang thai, liet ke capability
 * du kien va dieu huong sang feature da hoat dong.
 */
export function MvpPlaceholder({
  title,
  subtitle,
  statusNote,
  planned,
  cta,
  secondaryCta,
}: Props) {
  return (
    <>
      <div className="dash-page-head">
        <div>
          <h1>{title}</h1>
          <div className="muted">{subtitle}</div>
        </div>
        <div className="dash-table-actions">
          {secondaryCta && (
            <Link to={secondaryCta.to} className="dash-btn">
              {secondaryCta.label}
            </Link>
          )}
          {cta && (
            <Link to={cta.to} className="dash-btn dash-btn-primary">
              {cta.label}
            </Link>
          )}
        </div>
      </div>

      <div
        className="dash-table-card"
        style={{
          padding: '14px 18px',
          marginBottom: 16,
          borderLeft: '4px solid #f59e0b',
          background: '#fffbeb',
        }}
      >
        <strong style={{ color: '#92400e' }}>Trang thai MVP:</strong>{' '}
        <span style={{ color: '#92400e' }}>{statusNote}</span>
      </div>

      <div className="dash-table-card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>
          Chuc nang trong ke hoach
        </h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Cac muc duoi day la pham vi nghiep vu cua module, se duoc bat khi API
          san sang.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {planned.map((p) => (
            <div
              key={p.label}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.label}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
