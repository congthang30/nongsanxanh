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
  const [modal, setModal] = useState<{ row: InvRow; mode: 'import' | 'adjust' | 'export' } | null>(null);

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
                <button className="dash-btn dash-btn-sm" onClick={() => setModal({ row: r, mode: 'export' })} disabled={r.available <= 0}>Xuat / hu</button>
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
  row: InvRow; mode: 'import' | 'adjust' | 'export'; onClose: () => void; onDone: () => void;
}) {
  const { push } = useToastStore();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [exportKind, setExportKind] = useState<'EXPORT' | 'LOSS'>('EXPORT');

  const mut = useMutation({
    mutationFn: () => {
      if (mode === 'import') {
        return api.post('/warehouse/inventory/import', {
          variantId: row.variantId,
          quantity: Number(value),
          reason: reason || undefined,
        });
      }
      if (mode === 'adjust') {
        return api.post('/warehouse/inventory/adjust', {
          variantId: row.variantId,
          newQuantity: Number(value),
          reason: reason || undefined,
        });
      }
      // export
      return api.post('/warehouse/inventory/export', {
        variantId: row.variantId,
        quantity: Number(value),
        reason,
        kind: exportKind,
      });
    },
    onSuccess: () => {
      push(mode === 'import'
        ? 'Da nhap hang'
        : mode === 'adjust'
        ? 'Da dieu chinh ton'
        : exportKind === 'LOSS' ? 'Da ghi nhan hu hang' : 'Da xuat kho');
      onDone();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const reasonRequired = mode === 'export';
  const valueLabel = mode === 'import'
    ? 'So luong nhap them'
    : mode === 'adjust'
    ? 'So luong ton thuc te moi'
    : 'So luong xuat / danh hu';
  const title = mode === 'import'
    ? 'Nhap hang'
    : mode === 'adjust'
    ? 'Kiem ke / dieu chinh'
    : 'Xuat kho / Ghi nhan hu hang';
  const submitDisabled =
    !value ||
    (reasonRequired && reason.trim().length < 3) ||
    mut.isPending;

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">{row.productName} ({row.sku}) — ton hien tai: {row.quantityOnHand} {row.unit} · kha dung: {row.available}</p>
        {mode === 'export' && (
          <div className="flex gap-sm" style={{ marginTop: 12 }}>
            <button
              type="button"
              className={`dash-btn dash-btn-sm ${exportKind === 'EXPORT' ? 'dash-btn-primary' : ''}`}
              onClick={() => setExportKind('EXPORT')}
            >
              Xuat / chuyen di
            </button>
            <button
              type="button"
              className={`dash-btn dash-btn-sm ${exportKind === 'LOSS' ? 'dash-btn-primary' : ''}`}
              onClick={() => setExportKind('LOSS')}
            >
              Hu hong / mat
            </button>
          </div>
        )}
        <label style={{ display: 'block', marginTop: 12 }}>
          {valueLabel}
          <input className="input" type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>
        <label style={{ display: 'block', marginTop: 10 }}>
          Ly do {reasonRequired && <span style={{ color: '#dc2626' }}>*</span>}
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonRequired ? 'VD: Hu vi van chuyen, het han...' : 'Tuy chon'}
          />
        </label>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Huy</button>
          <button className="btn btn-primary" disabled={submitDisabled} onClick={() => mut.mutate()}>Xac nhan</button>
        </div>
      </div>
    </div>
  );
}
