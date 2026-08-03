import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';

interface OrderToPick {
  id: string; orderNumber: string; status: string;
  items: { id: string }[];
}
interface InvRow { id: string; isLowStock: boolean; }

export default function WarehouseDashboard() {
  const { data: toPick } = useQuery({
    queryKey: ['wh-to-pick'],
    queryFn: () => api.get('/warehouse/orders-to-pick').then((r) => r.data.data as OrderToPick[]),
  });
  const { data: lowStock } = useQuery({
    queryKey: ['wh-low-stock'],
    queryFn: () => api.get('/warehouse/low-stock').then((r) => r.data.data as InvRow[]),
  });

  const waitingConfirmation = (toPick ?? []).filter((o) =>
    ['PLACED', 'STORE_CONFIRMED'].includes(o.status),
  ).length;
  const picking = (toPick ?? []).filter((o) => o.status === 'PICKING').length;

  return (
    <>
      <PageHeader title="Kho cửa hàng" subtitle="Xác nhận đơn, soạn hàng và quản lý tồn kho" />
      <div className="dash-stat-grid">
        <StatCard icon="Clock" label="Chờ xác nhận" value={waitingConfirmation} color="#ca8a04" />
        <StatCard icon="Box" label="Đang soạn" value={picking} color="#0891b2" />
        <StatCard icon="AlertTriangle" label="Sản phẩm sắp hết" value={lowStock?.length ?? 0} color="#dc2626" />
      </div>
      <div className="dash-quick-grid" style={{ marginTop: 24 }}>
        <Link to="/warehouse/pick" className="dash-quick-card">
          <strong>Xác nhận &amp; soạn hàng</strong>
          <span className="muted">Kiểm tra đơn mới, xác nhận hoặc báo thiếu hàng</span>
        </Link>
        <Link to="/warehouse/inventory" className="dash-quick-card">
          <strong>Tồn kho</strong>
          <span className="muted">Nhập hàng, điều chỉnh tồn kho</span>
        </Link>
      </div>
    </>
  );
}
