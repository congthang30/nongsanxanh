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
      <PageHeader title="Tổng quan chuỗi cửa hàng" subtitle="Theo dõi vận hành toàn hệ thống" />
      <div className="dash-stat-grid">
        <StatCard icon="" label="Doanh thu hôm nay" value={data?.revenue ?? 0} format={formatVnd} color="#16a34a" />
        <StatCard icon="" label="Đơn mới" value={data?.totalOrders ?? 0} color="#0891b2" />
        <StatCard icon="" label="Đơn đang xử lý" value={data?.pendingOrders ?? 0} color="#ca8a04" />
        <StatCard icon="" label="Đơn giao thất bại" value={data?.deliveryFailed ?? 0} color="#dc2626" />
        <StatCard icon="" label="Cửa hàng sắp hết hàng" value={data?.lowStockStoreCount ?? 0} color="#ea580c" />
        <StatCard icon="" label="Cửa hàng hoạt động" value={data?.totalStores ?? 0} color="#0d9488" />
        <StatCard icon="" label="Người dùng" value={data?.totalUsers ?? 0} color="#7c3aed" />
      </div>

      <div className="dash-quick-grid" style={{ marginTop: 24 }}>
        <Link to="/admin/stores" className="dash-quick-card">
          <strong>Quản lý cửa hàng</strong>
          <span className="muted">Thêm cửa hàng, gán quản lý / shipper, khu vực phục vụ</span>
        </Link>
        <Link to="/admin/orders" className="dash-quick-card">
          <strong>Đơn hàng toàn hệ thống</strong>
          <span className="muted">Theo dõi, điều chuyển cửa hàng, hoàn tiền</span>
        </Link>
        <Link to="/admin/products" className="dash-quick-card">
          <strong>Sản phẩm</strong>
          <span className="muted">Quản lý danh mục sản phẩm chung</span>
        </Link>
        <Link to="/admin/reports" className="dash-quick-card">
          <strong>Báo cáo</strong>
          <span className="muted">Doanh thu và hiệu suất từng cửa hàng</span>
        </Link>
      </div>
    </>
  );
}
