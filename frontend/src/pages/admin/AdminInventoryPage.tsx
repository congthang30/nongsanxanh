import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface StoreOpt { id: string; name: string; }
interface InvRow {
  id: string; sku: string; productName: string; unit: string;
  quantityOnHand: number; reservedQuantity: number; available: number;
  lowStockThreshold: number; status: string;
}

export default function AdminInventoryPage() {
  const [storeId, setStoreId] = useState('');

  const { data: stores } = useQuery({
    queryKey: ['admin-stores-opt'],
    queryFn: () => api.get('/admin/stores').then((r) => r.data.data as StoreOpt[]),
  });

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['admin-inventory', storeId],
    enabled: !!storeId,
    queryFn: () => api.get('/admin/inventory', { params: { storeId } }).then((r) => r.data.data as InvRow[]),
  });

  return (
    <>
      <PageHeader title="Ton kho theo cua hang" subtitle="Xem ton kho cua tung cua hang trong chuoi" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 320 }} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">-- Chon cua hang --</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {storeId ? (
        <DataTable<InvRow>
          rows={inventory ?? []}
          loading={isLoading}
          rowKey={(r) => r.id}
          columns={[
            { key: 'product', title: 'San pham', render: (r) => <strong>{r.productName}</strong> },
            { key: 'sku', title: 'SKU', render: (r) => <span className="muted">{r.sku}</span> },
            { key: 'onHand', title: 'Ton kho', align: 'right', render: (r) => `${r.quantityOnHand} ${r.unit}` },
            { key: 'reserved', title: 'Dang giu', align: 'right', render: (r) => r.reservedQuantity },
            { key: 'available', title: 'Kha dung', align: 'right', render: (r) => <strong style={{ color: r.available <= r.lowStockThreshold ? '#dc2626' : '#16a34a' }}>{r.available}</strong> },
            { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      ) : (
        <div className="dash-table-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Chon cua hang de xem ton kho.
        </div>
      )}
    </>
  );
}
