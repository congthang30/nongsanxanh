import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';

interface Dashboard {
  store: {
    name: string;
    code: string;
    status: string;
    primaryShipper: {
      id: string;
      email: string | null;
      phone: string | null;
      profile: { fullName: string | null } | null;
    } | null;
  } | null;
  counts: Record<string, number>;
  ordersToday: number;
  revenueToday: number;
  lowStockCount: number;
  lowStockItems: { id: string; productName: string; available: number; unit: string }[];
}

export default function StoreManagerDashboard() {
  const { data } = useQuery({
    queryKey: ['sm-dashboard'],
    queryFn: () => api.get('/store-manager/dashboard').then((r) => r.data.data as Dashboard),
  });
  const c = data?.counts ?? {};

  return (
    <>
      <PageHeader
        title={data?.store ? data.store.name : 'Cửa hàng của tôi'}
        subtitle="Tổng quan hoạt động cửa hàng hôm nay"
      />
      <div className="dash-stat-grid">
        <StatCard icon="ClipboardList" label="Đơn mới" value={c.new ?? 0} color="#0891b2" />
        <StatCard icon="Package" label="Đang soạn" value={(c.confirmed ?? 0) + (c.picking ?? 0) + (c.packed ?? 0)} color="#ca8a04" />
        <StatCard icon="Truck" label="Đang giao" value={c.outForDelivery ?? 0} color="#7c3aed" />
        <StatCard icon="ShoppingBag" label="Đơn hôm nay" value={data?.ordersToday ?? 0} color="#16a34a" />
        <StatCard icon="TrendingUp" label="Doanh thu hôm nay" value={data?.revenueToday ?? 0} format={formatVnd} color="#15803d" />
        <StatCard icon="AlertTriangle" label="Sản phẩm sắp hết" value={data?.lowStockCount ?? 0} color="#dc2626" />
      </div>

      <div className="dash-quick-grid" style={{ marginTop: 24 }}>
        <Link to="/store-manager/orders" className="dash-quick-card">
          <strong>Đơn hàng</strong>
          <span className="muted">Xác nhận, theo dõi và điều phối đơn</span>
        </Link>
        <Link to="/store-manager/inventory" className="dash-quick-card">
          <strong>Tồn kho</strong>
          <span className="muted">Kiểm tra tồn kho cửa hàng</span>
        </Link>
        <Link to="/store-manager/staff" className="dash-quick-card">
          <strong>Nhân viên</strong>
          <span className="muted">Quản lý nhân sự cửa hàng</span>
        </Link>
        <div className="dash-quick-card" style={{ cursor: 'default' }}>
          <strong>Shipper chính</strong>
          {data?.store?.primaryShipper ? (
            <span className="muted">
              {data.store.primaryShipper.profile?.fullName ?? data.store.primaryShipper.email}
              {data.store.primaryShipper.phone ? ` · ${data.store.primaryShipper.phone}` : ''}
            </span>
          ) : (
            <span className="muted" style={{ color: '#dc2626' }}>
              Chưa gán. Liên hệ admin để gán shipper chính.
            </span>
          )}
        </div>
      </div>

      {data && data.lowStockItems.length > 0 && (
        <div className="dash-table-card" style={{ marginTop: 24, padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Cảnh báo tồn kho thấp</h3>
          <div className="stack gap-sm">
            {data.lowStockItems.map((it) => (
              <div key={it.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{it.productName}</span>
                <strong style={{ color: '#dc2626' }}>Còn {it.available} {it.unit}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
