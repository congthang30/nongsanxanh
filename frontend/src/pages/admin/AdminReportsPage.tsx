import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { StatCard } from '../../dashboard/components/StatCard';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface RevenueReport {
  periodDays: number; totalRevenue: number; orderCount: number; aov: number;
  revenueByDay: { date: string; revenue: number; orders: number }[];
}
interface StoreReport {
  storeId: string; name: string; code: string; status: string;
  totalOrders: number; completedOrders: number; revenue: number;
}

export default function AdminReportsPage() {
  const { data: revenue } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => api.get('/admin/reports/revenue', { params: { days: 30 } }).then((r) => r.data.data as RevenueReport),
  });
  const { data: storeReport, isLoading } = useQuery({
    queryKey: ['admin-store-report'],
    queryFn: () => api.get('/admin/reports/stores').then((r) => r.data.data as StoreReport[]),
  });

  const maxRev = Math.max(1, ...(revenue?.revenueByDay ?? []).map((d) => d.revenue));

  return (
    <>
      <PageHeader title="Bao cao" subtitle="Doanh thu va hieu suat cua hang (30 ngay)" />
      <div className="dash-stat-grid">
        <StatCard icon="" label="Doanh thu 30 ngay" value={revenue?.totalRevenue ?? 0} format={formatVnd} color="#16a34a" />
        <StatCard icon="" label="So don hoan tat" value={revenue?.orderCount ?? 0} color="#0891b2" />
        <StatCard icon="" label="Gia tri TB/don" value={revenue?.aov ?? 0} format={formatVnd} color="#7c3aed" />
      </div>

      <div className="dash-table-card" style={{ marginTop: 24, padding: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Doanh thu theo ngay</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
          {(revenue?.revenueByDay ?? []).map((d) => (
            <div key={d.date} title={`${d.date}: ${formatVnd(d.revenue)}`}
              style={{ flex: 1, background: 'linear-gradient(180deg,#34d399,#16a34a)', borderRadius: '4px 4px 0 0', height: `${(d.revenue / maxRev) * 100}%`, minHeight: 2 }} />
          ))}
          {(revenue?.revenueByDay ?? []).length === 0 && <span className="muted">Chua co du lieu.</span>}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <DataTable<StoreReport>
          title="Hieu suat tung cua hang"
          rows={storeReport ?? []}
          loading={isLoading}
          rowKey={(r) => r.storeId}
          columns={[
            { key: 'name', title: 'Cua hang', render: (r) => <strong>{r.name}</strong> },
            { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'orders', title: 'Tong don', align: 'right', render: (r) => r.totalOrders },
            { key: 'done', title: 'Hoan tat', align: 'right', render: (r) => r.completedOrders },
            { key: 'revenue', title: 'Doanh thu', align: 'right', render: (r) => <strong>{formatVnd(r.revenue)}</strong> },
          ]}
        />
      </div>
    </>
  );
}
