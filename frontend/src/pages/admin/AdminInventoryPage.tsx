import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { StockMovementModal, type StockMovementMode } from '../../dashboard/components/StockMovementModal';

interface StoreOpt { id: string; name: string; }
interface InvRow {
  id: string; variantId: string; sku: string; productName: string; unit: string;
  quantityOnHand: number; reservedQuantity: number; available: number;
  lowStockThreshold: number; status: string;
}

export default function AdminInventoryPage() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [modal, setModal] = useState<{ row: InvRow; mode: StockMovementMode } | null>(null);

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
      <PageHeader title="Tồn kho theo cửa hàng" subtitle="Xem tồn kho của từng cửa hàng trong chuỗi" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 320 }} value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Chọn cửa hàng">
          <option value="">-- Chọn cửa hàng --</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {storeId ? (
        <>
        <DataTable<InvRow>
          rows={inventory ?? []}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyText="Cửa hàng này chưa có tồn kho"
          columns={[
            { key: 'product', title: 'Sản phẩm', render: (r) => <strong>{r.productName}</strong> },
            { key: 'sku', title: 'SKU', render: (r) => <span className="muted">{r.sku}</span> },
            { key: 'onHand', title: 'Tồn kho', align: 'right', render: (r) => `${r.quantityOnHand} ${r.unit}` },
            { key: 'reserved', title: 'Đang giữ', align: 'right', render: (r) => r.reservedQuantity },
            { key: 'available', title: 'Khả dụng', align: 'right', render: (r) => <strong style={{ color: r.available <= r.lowStockThreshold ? '#dc2626' : '#16a34a' }}>{r.available}</strong> },
            { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
            {
              key: 'actions',
              title: 'Thao tác',
              render: (r) => (
                <div className="dash-row-actions">
                  <button className="dash-btn dash-btn-sm dash-btn-primary" onClick={() => setModal({ row: r, mode: 'import' })}>Nhập</button>
                  <button className="dash-btn dash-btn-sm" disabled={r.available <= 0} onClick={() => setModal({ row: r, mode: 'export' })}>Xuất / hủy</button>
                  <button className="dash-btn dash-btn-sm" onClick={() => setModal({ row: r, mode: 'adjust' })}>Kiểm kê</button>
                </div>
              ),
            },
          ]}
        />
          {modal && (
            <StockMovementModal
              row={modal.row}
              mode={modal.mode}
              endpointPrefix="/admin/inventory"
              storeId={storeId}
              onClose={() => setModal(null)}
              onDone={() => {
                setModal(null);
                qc.invalidateQueries({ queryKey: ['admin-inventory', storeId] });
              }}
            />
          )}
        </>
      ) : (
        <div className="dash-table-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Chọn cửa hàng để xem tồn kho.
        </div>
      )}
    </>
  );
}
