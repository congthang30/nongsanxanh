import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface InvRow {
  id: string; variantId: string; sku: string; productName: string; unit: string;
  quantityOnHand: number; reservedQuantity: number; available: number;
  lowStockThreshold: number; isLowStock: boolean; status: string;
  basePrice: number; salePrice: number | null;
}

export default function WarehouseInventory() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [lowOnly, setLowOnly] = useState(false);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ row: InvRow; mode: 'import' | 'adjust' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['wh-inventory', lowOnly, q],
    queryFn: () => api.get('/warehouse/inventory', { params: { lowStock: lowOnly || undefined, q: q || undefined } }).then((r) => r.data.data as InvRow[]),
  });

  return (
    <>
      <PageHeader title="Ton kho" subtitle="Nhap hang va dieu chinh ton kho cua hang" />
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
          { key: 'onHand', title: 'Ton kho', align: 'right', render: (r) => `${r.quantityOnHand} ${r.unit}` },
          { key: 'reserved', title: 'Dang giu', align: 'right', render: (r) => r.reservedQuantity },
          { key: 'available', title: 'Kha dung', align: 'right', render: (r) => <strong style={{ color: r.isLowStock ? '#dc2626' : '#16a34a' }}>{r.available}</strong> },
          { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: 'Thao tac', render: (r) => (
              <div className="dash-row-actions">
                <button className="dash-btn dash-btn-sm dash-btn-primary" onClick={() => setModal({ row: r, mode: 'import' })}>Nhap</button>
                <button className="dash-btn dash-btn-sm" onClick={() => setModal({ row: r, mode: 'adjust' })}>Kiem ke</button>
              </div>
            ),
          },
        ]}
      />
      {modal && (
        <StockModal
          row={modal.row}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); qc.invalidateQueries({ queryKey: ['wh-inventory'] }); }}
        />
      )}
    </>
  );
}

function StockModal({ row, mode, onClose, onDone }: {
  row: InvRow; mode: 'import' | 'adjust'; onClose: () => void; onDone: () => void;
}) {
  const { push } = useToastStore();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: () => mode === 'import'
      ? api.post('/warehouse/inventory/import', { variantId: row.variantId, quantity: Number(value), reason: reason || undefined })
      : api.post('/warehouse/inventory/adjust', { variantId: row.variantId, newQuantity: Number(value), reason: reason || undefined }),
    onSuccess: () => { push(mode === 'import' ? 'Da nhap hang' : 'Da dieu chinh ton'); onDone(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'import' ? 'Nhap hang' : 'Kiem ke / dieu chinh'}</h2>
        <p className="muted">{row.productName} ({row.sku}) — ton hien tai: {row.quantityOnHand} {row.unit}</p>
        <label style={{ display: 'block', marginTop: 12 }}>
          {mode === 'import' ? 'So luong nhap them' : 'So luong ton thuc te moi'}
          <input className="input" type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>
        <label style={{ display: 'block', marginTop: 10 }}>
          Ly do (tuy chon)
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Huy</button>
          <button className="btn btn-primary" disabled={!value || mut.isPending} onClick={() => mut.mutate()}>Xac nhan</button>
        </div>
      </div>
    </div>
  );
}
