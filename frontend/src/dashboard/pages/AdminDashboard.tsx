import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';

interface Summary {
  totalOrders: number;
  totalStores: number;
  pendingOrders: number;
  deliveryFailed: number;
  totalUsers: number;
  revenue: number;
  lowStockStoreCount: number;
}

export default function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: () => api.get('/admin/dashboard/summary').then((r) => r.data.data as Summary),
  });

  return (
    <>
      <PageHeader title="Tong quan chuoi cua hang" subtitle="Theo doi van hanh toan he thong" />
      <div className="dash-stat-grid">
        <StatCard icon="" label="Cua hang hoat dong" value={data?.totalStores ?? 0} color="#16a34a" />
        <StatCard icon="" label="Tong don hang" value={data?.totalOrders ?? 0} color="#0891b2" />
        <StatCard icon="" label="Don dang xu ly" value={data?.pendingOrders ?? 0} color="#ca8a04" />
        <StatCard icon="" label="Doanh thu" value={data?.revenue ?? 0} format={formatVnd} color="#7c3aed" />
        <StatCard icon="" label="Giao that bai" value={data?.deliveryFailed ?? 0} color="#dc2626" />
        <StatCard icon="" label="Cua hang sap het hang" value={data?.lowStockStoreCount ?? 0} color="#ea580c" />
        <StatCard icon="" label="Nguoi dung" value={data?.totalUsers ?? 0} color="#0d9488" />
      </div>

      <div className="dash-quick-grid" style={{ marginTop: 24 }}>
        <Link to="/admin/stores" className="dash-quick-card">
          <strong>Quan ly cua hang</strong>
          <span className="muted">Them cua hang, gan quan ly / shipper, khu vuc phuc vu</span>
        </Link>
        <Link to="/admin/orders" className="dash-quick-card">
          <strong>Don hang toan he thong</strong>
          <span className="muted">Theo doi, dieu chuyen cua hang, hoan tien</span>
        </Link>
        <Link to="/admin/products" className="dash-quick-card">
          <strong>San pham</strong>
          <span className="muted">Quan ly danh muc san pham chung</span>
        </Link>
        <Link to="/admin/reports" className="dash-quick-card">
          <strong>Bao cao</strong>
          <span className="muted">Doanh thu va hieu suat tung cua hang</span>
        </Link>
      </div>
    </>
  );
}
