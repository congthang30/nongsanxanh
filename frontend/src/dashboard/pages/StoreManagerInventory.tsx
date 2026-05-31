import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface InvRow {
  id: string; sku: string; productName: string; unit: string;
  quantityOnHand: number; reservedQuantity: number; available: number;
  lowStockThreshold: number; isLowStock: boolean; status: string;
  basePrice: number; salePrice: number | null;
}

export default function StoreManagerInventory() {
  const [lowOnly, setLowOnly] = useState(false);
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sm-inventory', lowOnly, q],
    queryFn: () => api.get('/store-manager/inventory', { params: { lowStock: lowOnly || undefined, q: q || undefined } }).then((r) => r.data.data as InvRow[]),
  });

  return (
    <>
      <PageHeader title="Ton kho cua hang" subtitle="Theo doi ton kho san pham tai cua hang" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Tim san pham / SKU" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <label className="flex gap-sm center">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Chi hien sap het hang
        </label>
      </div>
      <DataTable<InvRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'product', title: 'San pham', render: (r) => <strong>{r.productName}</strong> },
          { key: 'sku', title: 'SKU', render: (r) => <span className="muted">{r.sku}</span> },
          { key: 'price', title: 'Gia', align: 'right', render: (r) => formatVnd(r.salePrice ?? r.basePrice) },
          { key: 'onHand', title: 'Ton kho', align: 'right', render: (r) => `${r.quantityOnHand} ${r.unit}` },
          { key: 'reserved', title: 'Dang giu', align: 'right', render: (r) => r.reservedQuantity },
          { key: 'available', title: 'Kha dung', align: 'right', render: (r) => <strong style={{ color: r.isLowStock ? '#dc2626' : '#16a34a' }}>{r.available}</strong> },
          { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </>
  );
}
