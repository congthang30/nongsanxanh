import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { DataTable } from '../components/DataTable';

interface DailyReport {
  range: { from: string; to: string };
  revenue: number;
  billCount: number;
  avgBillValue: number;
  voidCount: number;
  refundCount: number;
  inventoryReducedUnits: number;
  inventoryTxCount: number;
  daily: { date: string; revenue: number; bills: number }[];
  byCashier: { cashierId: string; cashierName: string; revenue: number; bills: number }[];
  topProducts: { name: string; sku: string; quantity: number; revenue: number }[];
}

interface ShiftRow {
  id: string; cashierName: string; status: string;
  openedAt: string; closedAt: string | null;
  openingCash: number; expectedCash: number; countedCash: number | null; cashDifference: number | null;
  saleCount: number;
}

export default function POSReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['pos-report-daily'],
    queryFn: () => api.get('/pos/reports/daily').then((r) => r.data.data as DailyReport),
  });
  const { data: shifts } = useQuery({
    queryKey: ['pos-report-shifts'],
    queryFn: () => api.get('/pos/reports/shifts').then((r) => r.data.data as ShiftRow[]),
  });

  const maxRev = Math.max(1, ...(data?.daily ?? []).map((d) => d.revenue));

  return (
    <>
      <PageHeader
        title="Bao cao POS tai quay"
        subtitle="Doanh thu ban hang tai cua hang 7 ngay gan nhat"
        actions={
          <Link to="/pos" className="dash-btn dash-btn-primary">
            Mo man hinh thu ngan
          </Link>
        }
      />

      <div className="dash-stat-grid">
        <StatCard icon="" label="Doanh thu POS" value={data?.revenue ?? 0} format={formatVnd} color="#16a34a" />
        <StatCard icon="" label="So hoa don" value={data?.billCount ?? 0} color="#0891b2" />
        <StatCard icon="" label="Gia tri TB/hoa don" value={data?.avgBillValue ?? 0} format={formatVnd} color="#7c3aed" />
        <StatCard icon="" label="Ton kho da ban (POS)" value={data?.inventoryReducedUnits ?? 0} color="#ca8a04" />
        <StatCard icon="" label="Hoa don huy" value={data?.voidCount ?? 0} color="#dc2626" />
        <StatCard icon="" label="Hoa don hoan tra" value={data?.refundCount ?? 0} color="#dc2626" />
      </div>

      <div className="dash-table-card" style={{ marginTop: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Doanh thu POS theo ngay</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
          {(data?.daily ?? []).map((d) => (
            <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
              <div
                title={formatVnd(d.revenue)}
                style={{
                  background: 'linear-gradient(180deg,#34d399,#16a34a)',
                  borderRadius: '4px 4px 0 0',
                  height: `${(d.revenue / maxRev) * 130}px`,
                  minHeight: 2,
                }}
              />
              <span className="muted" style={{ fontSize: 10 }}>{d.date.slice(5)}</span>
            </div>
          ))}
          {(data?.daily ?? []).length === 0 && <span className="muted">Chua co du lieu.</span>}
        </div>
      </div>

      <div className="dash-grid-2">
        <DataTable
          title="Top san pham ban tai quay"
          rows={data?.topProducts ?? []}
          loading={isLoading}
          rowKey={(r) => r.sku}
          columns={[
            { key: 'name', title: 'San pham', render: (r) => <strong>{r.name}</strong> },
            { key: 'qty', title: 'SL ban', align: 'right', render: (r) => r.quantity },
            { key: 'rev', title: 'Doanh thu', align: 'right', render: (r) => formatVnd(r.revenue) },
          ]}
        />
        <DataTable
          title="Doanh thu theo thu ngan"
          rows={data?.byCashier ?? []}
          loading={isLoading}
          rowKey={(r) => r.cashierId}
          columns={[
            { key: 'name', title: 'Thu ngan', render: (r) => r.cashierName },
            { key: 'bills', title: 'Hoa don', align: 'right', render: (r) => r.bills },
            { key: 'rev', title: 'Doanh thu', align: 'right', render: (r) => formatVnd(r.revenue) },
          ]}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <DataTable<ShiftRow>
          title="Doi soat tien mat theo ca"
          rows={shifts ?? []}
          rowKey={(r) => r.id}
          columns={[
            { key: 'cashier', title: 'Thu ngan', render: (r) => <strong>{r.cashierName}</strong> },
            { key: 'status', title: 'Trang thai', render: (r) => (r.status === 'OPEN' ? 'Dang mo' : 'Da dong') },
            { key: 'opening', title: 'Dau ca', align: 'right', render: (r) => formatVnd(r.openingCash) },
            { key: 'expected', title: 'Du kien', align: 'right', render: (r) => formatVnd(r.expectedCash) },
            { key: 'counted', title: 'Dem duoc', align: 'right', render: (r) => (r.countedCash == null ? '—' : formatVnd(r.countedCash)) },
            {
              key: 'diff', title: 'Chenh lech', align: 'right',
              render: (r) =>
                r.cashDifference == null ? '—' : (
                  <strong style={{ color: r.cashDifference === 0 ? '#16a34a' : '#dc2626' }}>
                    {r.cashDifference > 0 ? '+' : ''}{formatVnd(r.cashDifference)}
                  </strong>
                ),
            },
            { key: 'sales', title: 'So HD', align: 'right', render: (r) => r.saleCount },
          ]}
        />
      </div>
    </>
  );
}
