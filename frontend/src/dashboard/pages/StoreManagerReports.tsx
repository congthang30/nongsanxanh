import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';

interface Report {
  totalOrders: number; completedOrders: number; revenue: number; avgOrderValue: number;
  daily: { date: string; orders: number; revenue: number }[];
}

export default function StoreManagerReports() {
  const { data } = useQuery({
    queryKey: ['sm-reports'],
    queryFn: () => api.get('/store-manager/reports').then((r) => r.data.data as Report),
  });
  const maxRev = Math.max(1, ...(data?.daily ?? []).map((d) => d.revenue));

  return (
    <>
      <PageHeader title="Báo cáo cửa hàng" subtitle="Hiệu suất 7 ngày gần nhất" />
      <div className="dash-stat-grid">
        <StatCard icon="" label="Tổng đơn" value={data?.totalOrders ?? 0} color="#0891b2" />
        <StatCard icon="" label="Đơn hoàn tất" value={data?.completedOrders ?? 0} color="#16a34a" />
        <StatCard icon="" label="Doanh thu" value={data?.revenue ?? 0} format={formatVnd} color="#15803d" />
        <StatCard icon="" label="Giá trị TB/đơn" value={data?.avgOrderValue ?? 0} format={formatVnd} color="#7c3aed" />
      </div>
      <div className="dash-table-card" style={{ marginTop: 24, padding: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Doanh thu theo ngày</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
          {(data?.daily ?? []).map((d) => (
            <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
              <div title={`${formatVnd(d.revenue)}`}
                style={{ background: 'linear-gradient(180deg,#34d399,#16a34a)', borderRadius: '4px 4px 0 0', height: `${(d.revenue / maxRev) * 130}px`, minHeight: 2 }} />
              <span className="muted" style={{ fontSize: 10 }}>{d.date.slice(5)}</span>
            </div>
          ))}
          {(data?.daily ?? []).length === 0 && <span className="muted">Chưa có dữ liệu.</span>}
        </div>
      </div>
    </>
  );
}
