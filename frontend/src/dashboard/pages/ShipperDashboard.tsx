import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';

interface Job {
  id: string; status: string; codAmount: number | null;
  order: { orderNumber: string; grandTotal: number; status: string };
}

export default function ShipperDashboard() {
  const { data: active } = useQuery({
    queryKey: ['shipper-active'],
    queryFn: () => api.get('/shipper/jobs', { params: { scope: 'active' } }).then((r) => r.data.data as Job[]),
  });
  const { data: history } = useQuery({
    queryKey: ['shipper-history'],
    queryFn: () => api.get('/shipper/jobs', { params: { scope: 'history' } }).then((r) => r.data.data as Job[]),
  });

  const delivering = (active ?? []).filter((j) => j.status === 'OUT_FOR_DELIVERY' || j.status === 'PICKED_FROM_STORE').length;
  const assigned = (active ?? []).filter((j) => j.status === 'ASSIGNED').length;
  const deliveredToday = (history ?? []).filter((j) => j.status === 'DELIVERED').length;
  const codTotal = (active ?? []).reduce((s, j) => s + (j.codAmount ?? 0), 0);

  return (
    <>
      <PageHeader title="Shipper" subtitle="Đơn giao được gán trực tiếp từ cửa hàng của bạn" />
      <div className="dash-stat-grid">
        <StatCard icon="Inbox" label="Đơn chờ lấy" value={assigned} color="#ca8a04" />
        <StatCard icon="Truck" label="Đang giao" value={delivering} color="#0891b2" />
        <StatCard icon="CheckCircle" label="Đã giao (lịch sử)" value={deliveredToday} color="#16a34a" />
        <StatCard icon="DollarSign" label="COD cần thu" value={codTotal} format={formatVnd} color="#7c3aed" />
      </div>
      <div className="dash-quick-grid" style={{ marginTop: 24 }}>
        <Link to="/shipper/active" className="dash-quick-card">
          <strong>Đơn đang giao</strong>
          <span className="muted">Cập nhật trạng thái lấy hàng / giao hàng</span>
        </Link>
        <Link to="/shipper/history" className="dash-quick-card">
          <strong>Lịch sử giao</strong>
          <span className="muted">Các đơn đã hoàn tất hoặc thất bại</span>
        </Link>
      </div>
    </>
  );
}
