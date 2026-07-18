import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { StockMovementModal } from '../components/StockMovementModal';

interface InvRow {
  id: string; variantId: string; sku: string; productName: string; unit: string;
  quantityOnHand: number; reservedQuantity: number; available: number;
  lowStockThreshold: number; isLowStock: boolean; status: string;
  basePrice: number; salePrice: number | null;
}

export default function WarehouseInventory() {
  const qc = useQueryClient();
  const [lowOnly, setLowOnly] = useState(false);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ row: InvRow; mode: 'import' | 'adjust' | 'export' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['wh-inventory', lowOnly, q],
    queryFn: () => api.get('/warehouse/inventory', { params: { lowStock: lowOnly || undefined, q: q || undefined } }).then((r) => r.data.data as InvRow[]),
  });

  return (
    <>
      <PageHeader title="Tồn kho" subtitle="Nhập hàng và điều chỉnh tồn kho cửa hàng" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Tìm sản phẩm / SKU" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} aria-label="Tìm sản phẩm" />
        <label className="flex gap-sm center">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Chỉ hiện sắp hết hàng
        </label>
      </div>
      <DataTable<InvRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText="Không có sản phẩm tồn kho"
        columns={[
          { key: 'product', title: 'Sản phẩm', render: (r) => <strong>{r.productName}</strong> },
          { key: 'sku', title: 'SKU', render: (r) => <span className="muted">{r.sku}</span> },
          { key: 'onHand', title: 'Tồn kho', align: 'right', render: (r) => `${r.quantityOnHand} ${r.unit}` },
          { key: 'reserved', title: 'Đang giữ', align: 'right', render: (r) => r.reservedQuantity },
          { key: 'available', title: 'Khả dụng', align: 'right', render: (r) => <strong style={{ color: r.isLowStock ? '#dc2626' : '#16a34a' }}>{r.available}</strong> },
          { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: 'Thao tác', render: (r) => (
              <div className="dash-row-actions">
                <button className="dash-btn dash-btn-sm dash-btn-primary" onClick={() => setModal({ row: r, mode: 'import' })}>Nhập</button>
                <button className="dash-btn dash-btn-sm" onClick={() => setModal({ row: r, mode: 'export' })} disabled={r.available <= 0}>Xuất / hủy</button>
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
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); qc.invalidateQueries({ queryKey: ['wh-inventory'] }); }}
        />
      )}
    </>
  );
}
