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

  const confirmed = (toPick ?? []).filter((o) => o.status === 'STORE_CONFIRMED').length;
  const picking = (toPick ?? []).filter((o) => o.status === 'PICKING').length;

  return (
    <>
      <PageHeader title="Kho cua hang" subtitle="Soan hang va quan ly ton kho" />
      <div className="dash-stat-grid">
        <StatCard icon="" label="Cho soan" value={confirmed} color="#ca8a04" />
        <StatCard icon="" label="Dang soan" value={picking} color="#0891b2" />
        <StatCard icon="" label="SP sap het hang" value={lowStock?.length ?? 0} color="#dc2626" />
      </div>
      <div className="dash-quick-grid" style={{ marginTop: 24 }}>
        <Link to="/warehouse/pick" className="dash-quick-card">
          <strong>Soan hang</strong>
          <span className="muted">Don da xac nhan can soan va dong goi</span>
        </Link>
        <Link to="/warehouse/inventory" className="dash-quick-card">
          <strong>Ton kho</strong>
          <span className="muted">Nhap hang, dieu chinh ton kho</span>
        </Link>
      </div>
    </>
  );
}
