import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { posApi, POSReturn, POSSale, SaleListItem } from './pos.api';
import { formatVnd } from '../lib/format';
import { useToastStore } from '../lib/toast.store';
import { getErrorMessage } from '../lib/api';
import './pos.css';
import './pos-returns.css';

type Tab = 'create' | 'requested' | 'approved' | 'completed';

/**
 * POSReturnsPage - quan ly tra hang/hoan tien tai quay (Manager-only).
 * Flow: chon hoa don PAID -> tick item + so luong -> tao yeu cau (REQUESTED)
 *       -> manager duyet (APPROVED) -> hoan tat (COMPLETED, hoan ton kho).
 */
export default function POSReturnsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('create');

  return (
    <div className="pos-returns-root">
      <header className="pos-returns-topbar">
        <button className="pos-link-btn" onClick={() => navigate('/pos')}>
          ← Về POS
        </button>
        <h1>Trả hàng / Hoàn tiền</h1>
        <div />
      </header>

      <nav className="pos-returns-tabs">
        {(['create', 'requested', 'approved', 'completed'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`pos-returns-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </nav>

      <main className="pos-returns-body">
        {tab === 'create' && <CreateReturnPanel />}
        {tab !== 'create' && <ReturnList status={tab} />}
      </main>
    </div>
  );
}

function tabLabel(t: Tab): string {
  switch (t) {
    case 'create': return 'Tạo yêu cầu';
    case 'requested': return 'Chờ duyệt';
    case 'approved': return 'Đã duyệt';
    case 'completed': return 'Hoàn tất';
  }
}

// ============ Create return panel ============

function CreateReturnPanel() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [picks, setPicks] = useState<Record<string, { qty: number; restockable: boolean }>>({});

  const { data: paidSales = [], isLoading } = useQuery({
    queryKey: ['pos-paid-sales'],
    queryFn: () => posApi.listSales({ status: 'PAID' as const }),
  });

  const { data: sale } = useQuery({
    queryKey: ['pos-sale', selectedSaleId],
    enabled: !!selectedSaleId,
    queryFn: () => posApi.getSale(selectedSaleId!),
  });

  const createMut = useMutation({
    mutationFn: () => posApi.createReturn({
      saleId: selectedSaleId!,
      reason,
      items: Object.entries(picks)
        .filter(([, v]) => v.qty > 0)
        .map(([saleItemId, v]) => ({ saleItemId, quantity: v.qty, restockable: v.restockable })),
    }),
    onSuccess: () => {
      push('Đã tạo yêu cầu trả hàng');
      setSelectedSaleId(null); setReason(''); setPicks({});
      qc.invalidateQueries({ queryKey: ['pos-returns', 'REQUESTED'] });
      qc.invalidateQueries({ queryKey: ['pos-paid-sales'] });
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const refundTotal = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((s, it) => {
      const p = picks[it.id];
      if (!p || p.qty <= 0) return s;
      return s + Math.round(it.unitPrice * p.qty);
    }, 0);
  }, [sale, picks]);

  const canSubmit =
    !!selectedSaleId &&
    reason.trim().length >= 3 &&
    refundTotal > 0 &&
    !createMut.isPending;

  return (
    <div className="pos-returns-create">
      <section className="pos-returns-section">
        <h3>1. Chọn hóa đơn đã thanh toán</h3>
        {isLoading ? (
          <p className="muted">Đang tải...</p>
        ) : paidSales.length === 0 ? (
          <p className="muted">Chưa có hóa đơn đã thanh toán nào trong 7 ngày gần đây.</p>
        ) : (
          <div className="pos-returns-sale-list">
            {paidSales.map((s) => (
              <SaleCard
                key={s.id}
                sale={s}
                active={selectedSaleId === s.id}
                onClick={() => {
                  setSelectedSaleId(s.id);
                  setPicks({});
                  setReason('');
                }}
              />
            ))}
          </div>
        )}
      </section>

      {sale && (
        <>
          <section className="pos-returns-section">
            <h3>2. Chọn sản phẩm cần trả ({sale.saleNumber})</h3>
            <ItemPicker sale={sale} picks={picks} onChange={setPicks} />
          </section>

          <section className="pos-returns-section">
            <h3>3. Lý do trả</h3>
            <textarea
              className="pos-returns-textarea"
              rows={3}
              placeholder="VD: Khách đổi ý, hàng không đúng mẫu..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </section>

          <div className="pos-returns-summary">
            <div>
              <span>Tổng hoàn trả</span>
              <strong>{formatVnd(refundTotal)}</strong>
            </div>
            <button
              className="pos-btn pos-btn-primary"
              disabled={!canSubmit}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Đang lưu...' : 'Tạo yêu cầu'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SaleCard({ sale, active, onClick }: { sale: SaleListItem; active: boolean; onClick: () => void }) {
  return (
    <button className={`pos-returns-sale-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="pos-returns-sale-num">{sale.saleNumber}</div>
      <div className="pos-returns-sale-meta">
        {sale.itemCount} mặt hàng · {sale.cashierName}
      </div>
      <div className="pos-returns-sale-amount">{formatVnd(sale.grandTotal)}</div>
      <div className="pos-returns-sale-time">
        {sale.paidAt ? new Date(sale.paidAt).toLocaleString('vi-VN') : '-'}
      </div>
    </button>
  );
}

function ItemPicker({
  sale,
  picks,
  onChange,
}: {
  sale: POSSale;
  picks: Record<string, { qty: number; restockable: boolean }>;
  onChange: (p: Record<string, { qty: number; restockable: boolean }>) => void;
}) {
  const toggle = (itemId: string, maxQty: number) => {
    const next = { ...picks };
    if (next[itemId]) {
      delete next[itemId];
    } else {
      next[itemId] = { qty: maxQty, restockable: true };
    }
    onChange(next);
  };

  const setQty = (itemId: string, qty: number, max: number) => {
    if (qty <= 0 || qty > max) return;
    onChange({ ...picks, [itemId]: { ...picks[itemId], qty } });
  };

  const setRestockable = (itemId: string, value: boolean) => {
    onChange({ ...picks, [itemId]: { ...picks[itemId], restockable: value } });
  };

  return (
    <div className="pos-returns-item-list">
      {sale.items.map((it) => {
        const p = picks[it.id];
        const checked = !!p;
        return (
          <div key={it.id} className={`pos-returns-item ${checked ? 'active' : ''}`}>
            <div className="pos-returns-item-head">
              <label className="pos-returns-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(it.id, Number(it.quantity))}
                />
                <span>
                  <strong>{it.name}</strong>
                  <span className="muted"> · {formatVnd(it.unitPrice)} / {it.unit}</span>
                </span>
              </label>
              <span className="pos-returns-item-qty">
                Đã bán: {Number(it.quantity)} {it.unit}
              </span>
            </div>
            {checked && (
              <div className="pos-returns-item-controls">
                <label>
                  Số lượng trả
                  <input
                    type="number"
                    min={0.001}
                    max={Number(it.quantity)}
                    step={1}
                    value={p.qty}
                    onChange={(e) => setQty(it.id, Number(e.target.value), Number(it.quantity))}
                    className="pos-returns-input"
                  />
                </label>
                <label className="pos-returns-restock">
                  <input
                    type="checkbox"
                    checked={p.restockable}
                    onChange={(e) => setRestockable(it.id, e.target.checked)}
                  />
                  <span>Hàng còn tốt, hoàn kho</span>
                </label>
                <span className="pos-returns-item-total">
                  Hoàn: <b>{formatVnd(Math.round(it.unitPrice * p.qty))}</b>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============ Returns list / approve / complete ============

function ReturnList({ status }: { status: 'requested' | 'approved' | 'completed' }) {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const upper = status.toUpperCase() as 'REQUESTED' | 'APPROVED' | 'COMPLETED';

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['pos-returns', upper],
    queryFn: () => posApi.listReturns(),
  });

  const items = all.filter((r) => r.status === upper);

  const approveMut = useMutation({
    mutationFn: (id: string) => posApi.approveReturn(id),
    onSuccess: () => { push('Đã duyệt yêu cầu'); qc.invalidateQueries({ queryKey: ['pos-returns'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => posApi.completeReturn(id),
    onSuccess: () => { push('Đã hoàn tất trả hàng. Tồn kho đã cập nhật.'); qc.invalidateQueries({ queryKey: ['pos-returns'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  if (isLoading) return <p className="muted">Đang tải...</p>;
  if (items.length === 0) {
    return <p className="muted" style={{ padding: 24 }}>Không có yêu cầu {tabName(upper)}.</p>;
  }

  return (
    <div className="pos-returns-list">
      {items.map((r) => (
        <ReturnCard
          key={r.id}
          ret={r}
          onApprove={upper === 'REQUESTED' ? () => approveMut.mutate(r.id) : undefined}
          onComplete={upper === 'APPROVED' ? () => completeMut.mutate(r.id) : undefined}
          busy={approveMut.isPending || completeMut.isPending}
        />
      ))}
    </div>
  );
}

function tabName(s: string): string {
  switch (s) {
    case 'REQUESTED': return 'chờ duyệt';
    case 'APPROVED': return 'đã duyệt';
    case 'COMPLETED': return 'đã hoàn tất';
    default: return s.toLowerCase();
  }
}

function ReturnCard({
  ret,
  onApprove,
  onComplete,
  busy,
}: {
  ret: POSReturn;
  onApprove?: () => void;
  onComplete?: () => void;
  busy: boolean;
}) {
  return (
    <div className="pos-returns-return-card">
      <div className="between">
        <div>
          <strong>HD gốc: {ret.originalSale?.saleNumber ?? ret.originalSaleId.slice(0, 8)}</strong>
          <p className="muted" style={{ margin: '4px 0' }}>{ret.reason}</p>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {new Date(ret.createdAt).toLocaleString('vi-VN')} · {ret.cashier?.profile?.fullName ?? ret.cashier?.email ?? '-'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong className="pos-returns-refund">{formatVnd(ret.refundAmount)}</strong>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
            {ret.items.length} mặt hàng · {ret.items.filter((i) => i.restockable).length} hoàn kho
          </p>
        </div>
      </div>
      <div className="flex gap-sm" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        {onApprove && (
          <button className="pos-btn pos-btn-primary" disabled={busy} onClick={onApprove}>
            Duyệt yêu cầu
          </button>
        )}
        {onComplete && (
          <button className="pos-btn pos-btn-primary" disabled={busy} onClick={onComplete}>
            Hoàn tất (hoàn kho)
          </button>
        )}
      </div>
    </div>
  );
}
