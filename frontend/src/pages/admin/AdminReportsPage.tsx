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
interface Reconciliation {
  range: { from: string; to: string };
  online: { orderPaidTotal: number; paymentSuccessTotal: number; diff: number; balanced: boolean };
  pos: { salePaidTotal: number; posPaymentTotal: number; diff: number; balanced: boolean };
  refunds: { count: number; total: number };
  anomalies: {
    paidOrdersNoPayment: { id: string; orderNumber: string; grandTotal: number }[];
    successPaymentsOrderNotPaid: { id: string; amount: number; order: { orderNumber: string } | null }[];
  };
}
interface CodOutstanding {
  count: number; totalOutstanding: number;
  orders: {
    id: string; orderNumber: string; grandTotal: number;
    store: { name: string } | null;
    user: { profile: { fullName: string } | null; email: string | null };
  }[];
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
  const { data: recon } = useQuery({
    queryKey: ['admin-reconciliation'],
    queryFn: () => api.get('/admin/reports/reconciliation').then((r) => r.data.data as Reconciliation),
  });
  const { data: cod } = useQuery({
    queryKey: ['admin-cod-outstanding'],
    queryFn: () => api.get('/admin/reports/cod-outstanding').then((r) => r.data.data as CodOutstanding),
  });

  const maxRev = Math.max(1, ...(revenue?.revenueByDay ?? []).map((d) => d.revenue));

  return (
    <>
      <PageHeader title="Báo cáo" subtitle="Doanh thu và hiệu suất cửa hàng (30 ngày)" />
      <div className="dash-stat-grid">
        <StatCard icon="" label="Doanh thu 30 ngày" value={revenue?.totalRevenue ?? 0} format={formatVnd} color="#16a34a" />
        <StatCard icon="" label="Số đơn hoàn tất" value={revenue?.orderCount ?? 0} color="#0891b2" />
        <StatCard icon="" label="Giá trị TB/đơn" value={revenue?.aov ?? 0} format={formatVnd} color="#7c3aed" />
      </div>

      <div className="dash-table-card" style={{ marginTop: 24, padding: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Doanh thu theo ngày</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
          {(revenue?.revenueByDay ?? []).map((d) => (
            <div key={d.date} title={`${d.date}: ${formatVnd(d.revenue)}`}
              style={{ flex: 1, background: 'linear-gradient(180deg,#34d399,#16a34a)', borderRadius: '4px 4px 0 0', height: `${(d.revenue / maxRev) * 100}%`, minHeight: 2 }} />
          ))}
          {(revenue?.revenueByDay ?? []).length === 0 && <span className="muted">Chưa có dữ liệu.</span>}
        </div>
      </div>

      {/* P1-02: Đối soát doanh thu Order vs Payment vs POS (7 ngày) */}
      <div className="dash-table-card" style={{ marginTop: 24, padding: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Đối soát doanh thu (7 ngày gần nhất)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={{ border: '1px solid var(--dash-border, #e5e7eb)', borderRadius: 8, padding: 16 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Online + COD</div>
            <div>Đơn đã thu: <strong>{formatVnd(recon?.online.orderPaidTotal ?? 0)}</strong></div>
            <div>Thanh toán thành công: <strong>{formatVnd(recon?.online.paymentSuccessTotal ?? 0)}</strong></div>
            <div style={{ marginTop: 6, color: recon?.online.balanced ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {recon?.online.balanced ? 'Khớp' : `Lệch ${formatVnd(recon?.online.diff ?? 0)}`}
            </div>
          </div>
          <div style={{ border: '1px solid var(--dash-border, #e5e7eb)', borderRadius: 8, padding: 16 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>POS tại quầy</div>
            <div>Hóa đơn đã thu: <strong>{formatVnd(recon?.pos.salePaidTotal ?? 0)}</strong></div>
            <div>Thanh toán POS: <strong>{formatVnd(recon?.pos.posPaymentTotal ?? 0)}</strong></div>
            <div style={{ marginTop: 6, color: recon?.pos.balanced ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {recon?.pos.balanced ? 'Khớp' : `Lệch ${formatVnd(recon?.pos.diff ?? 0)}`}
            </div>
          </div>
          <div style={{ border: '1px solid var(--dash-border, #e5e7eb)', borderRadius: 8, padding: 16 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Hoàn tiền</div>
            <div>Số lần: <strong>{recon?.refunds.count ?? 0}</strong></div>
            <div>Tổng: <strong>{formatVnd(recon?.refunds.total ?? 0)}</strong></div>
          </div>
        </div>
        {((recon?.anomalies.paidOrdersNoPayment.length ?? 0) > 0 ||
          (recon?.anomalies.successPaymentsOrderNotPaid.length ?? 0) > 0) && (
          <div style={{ marginTop: 16, padding: 12, background: '#fef2f2', borderRadius: 8, color: '#991b1b' }}>
            <strong>Cảnh báo bất thường:</strong>
            {(recon?.anomalies.paidOrdersNoPayment.length ?? 0) > 0 && (
              <div>{recon?.anomalies.paidOrdersNoPayment.length} đơn đã thu nhưng không có thanh toán thành công</div>
            )}
            {(recon?.anomalies.successPaymentsOrderNotPaid.length ?? 0) > 0 && (
              <div>{recon?.anomalies.successPaymentsOrderNotPaid.length} thanh toán thành công nhưng đơn chưa thu tiền</div>
            )}
          </div>
        )}
      </div>

      {/* P1-04: Công nợ COD - đơn đã giao chưa thu tiền */}
      <div style={{ marginTop: 24 }}>
        <DataTable<NonNullable<CodOutstanding['orders']>[number]>
          title={`Công nợ COD chưa thu (${cod?.count ?? 0} đơn - ${formatVnd(cod?.totalOutstanding ?? 0)})`}
          rows={cod?.orders ?? []}
          rowKey={(o) => o.id}
          emptyText="Không có công nợ COD"
          columns={[
            { key: 'order', title: 'Mã đơn', render: (o) => <strong>#{o.orderNumber}</strong> },
            { key: 'store', title: 'Cửa hàng', render: (o) => o.store?.name ?? '—' },
            { key: 'customer', title: 'Khách hàng', render: (o) => o.user.profile?.fullName ?? o.user.email ?? '—' },
            { key: 'amount', title: 'Số tiền', align: 'right', render: (o) => <strong>{formatVnd(o.grandTotal)}</strong> },
          ]}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <DataTable<StoreReport>
          title="Hiệu suất từng cửa hàng"
          rows={storeReport ?? []}
          loading={isLoading}
          rowKey={(r) => r.storeId}
          emptyText="Chưa có dữ liệu cửa hàng"
          columns={[
            { key: 'name', title: 'Cửa hàng', render: (r) => <strong>{r.name}</strong> },
            { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'orders', title: 'Tổng đơn', align: 'right', render: (r) => r.totalOrders },
            { key: 'done', title: 'Hoàn tất', align: 'right', render: (r) => r.completedOrders },
            { key: 'revenue', title: 'Doanh thu', align: 'right', render: (r) => <strong>{formatVnd(r.revenue)}</strong> },
          ]}
        />
      </div>
    </>
  );
}
