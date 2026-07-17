import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { posApi, POSReturn, POSSale, SaleListItem } from './pos.api';
import { formatVnd } from '../lib/format';
import { useToastStore } from '../lib/toast.store';
import { getErrorMessage } from '../lib/api';
import { useAuthStore } from '../lib/auth.store';
import './pos.css';

type Tab = 'create' | 'requested' | 'approved' | 'completed';

export default function POSReturnsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('create');

  // Lấy thông tin ca làm việc để hiển thị ở Sidebar
  const { data: shift } = useQuery({
    queryKey: ['pos-current-shift'],
    queryFn: () => posApi.currentShift().catch(() => null),
  });

  return (
    <div className="bg-surface text-on-surface flex h-screen overflow-hidden w-full">
      {/* Top App Bar / Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-outline-variant h-16 flex items-center px-lg justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-label-bold text-label-bold font-semibold outline-none"
            onClick={() => navigate('/pos')}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Về POS
          </button>
        </div>
        <h1 className="font-headline-md text-headline-md text-primary font-bold absolute left-1/2 transform -translate-x-1/2">
          Trả hàng / Hoàn tiền
        </h1>
        <div className="flex items-center gap-4">
          {/* Placeholder for trailing actions */}
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-full w-full">
        {/* Side Navigation Bar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-surface-container-low border-r border-outline-variant shadow-md flex flex-col py-lg z-40 hidden md:flex">
          {/* Navigation Links */}
          <nav className="flex-1 px-4 space-y-2">
            <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-lg mx-2 my-1 font-label-bold text-label-bold transition-all hover:bg-primary-container/20 font-semibold" to="/pos">
              <span className="material-symbols-outlined">point_of_sale</span>
              New Sale
            </Link>
            <button className="w-[calc(100%-1rem)] flex items-center gap-3 px-4 py-3 bg-primary-container/20 text-on-primary-container rounded-lg mx-2 my-1 font-label-bold text-label-bold transition-all font-semibold text-left">
              <span className="material-symbols-outlined text-primary">receipt_long</span>
              Order History
            </button>
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed">
              <span className="material-symbols-outlined">inventory_2</span>
              Stock Check
            </div>
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed">
              <span className="material-symbols-outlined">groups</span>
              Customers
            </div>
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              Admin
            </div>
          </nav>
          {/* Footer Actions */}
          <div className="px-4 mt-auto space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed">
              <span className="material-symbols-outlined">help</span>
              Help
            </div>
            <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-lg mx-2 my-1 font-label-bold text-label-bold transition-all hover:bg-primary-container/20 font-semibold" to="/store">
              <span className="material-symbols-outlined">logout</span>
              Sign Out
            </Link>
            <div className="mt-4 px-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary font-bold border border-outline-variant">
                  {user?.fullName?.slice(0, 2).toUpperCase() ?? 'CT'}
                </div>
                <div>
                  <p className="font-label-bold text-label-bold text-on-surface font-bold">Terminal 01</p>
                  <p className="text-xs text-on-surface-variant">Cashier: {user?.fullName ?? user?.email}</p>
                </div>
              </div>
              <button 
                className="w-full py-2 px-4 bg-outline-variant text-on-surface font-label-bold font-semibold rounded-lg hover:bg-outline transition-colors disabled:opacity-50"
                disabled
              >
                {shift ? `Expected: ${formatVnd(shift.expectedCash)}` : 'Shift Closed'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 md:ml-64 bg-background h-full overflow-y-auto w-full">
          {/* Tabs Navigation */}
          <div className="border-b border-outline-variant bg-white sticky top-0 z-30">
            <div className="max-w-container-max mx-auto px-lg">
              <nav aria-label="Tabs" className="flex space-x-8">
                {(['create', 'requested', 'approved', 'completed'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm transition-all outline-none ${
                      tab === t
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {tabLabel(t)}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="max-w-container-max mx-auto px-lg py-xl">
            {tab === 'create' && <CreateReturnPanel />}
            {tab !== 'create' && <ReturnList status={tab} />}
          </div>
        </main>
      </div>
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
  const [searchQuery, setSearchQuery] = useState('');

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
      qc.invalidateQueries({ queryKey: ['pos-returns'] });
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

  const filteredSales = paidSales.filter((s) =>
    s.saleNumber.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-md items-start max-w-5xl">
      {/* Cột 1: Chọn hóa đơn */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-lg flex flex-col">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2 text-lg font-bold">
          1. Chọn hóa đơn đã thanh toán
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Tìm kiếm và chọn hóa đơn khách muốn trả hàng trong 7 ngày gần đây.
        </p>

        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant">search</span>
            <input 
              className="w-full pl-10 pr-4 py-2 rounded-full border border-outline-variant bg-surface focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm text-on-surface placeholder-on-surface-variant" 
              placeholder="Tìm kiếm mã hóa đơn..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-on-surface-variant py-4">Đang tải...</p>
        ) : filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 bg-surface-container-low rounded-lg border border-dashed border-outline-variant">
            <span className="material-symbols-outlined text-tertiary-container mb-2 text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            <p className="text-xs text-on-surface-variant text-center max-w-[200px]">
              Không tìm thấy dữ liệu hóa đơn phù hợp.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {filteredSales.map((s) => (
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
      </div>

      {/* Cột 2: Chọn sản phẩm và lý do trả hàng */}
      <div>
        {sale ? (
          <div className="flex flex-col gap-md">
            {/* Chọn sản phẩm */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-3 text-lg font-bold">
                2. Chọn sản phẩm cần trả (HD #{sale.saleNumber})
              </h2>
              <ItemPicker sale={sale} picks={picks} onChange={setPicks} />
            </div>

            {/* Lý do trả */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-3 text-lg font-bold">
                3. Lý do trả hàng
              </h2>
              <textarea
                className="w-full p-3 rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary outline-none text-sm"
                rows={3}
                placeholder="VD: Hàng lỗi, khách đổi ý, sản phẩm hỏng..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Tổng hợp & hành động */}
            <div className="bg-white p-6 rounded-xl border border-outline-variant shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant">Tổng hoàn tiền</span>
                <strong className="text-primary font-bold text-xl">{formatVnd(refundTotal)}</strong>
              </div>
              <button
                className="bg-primary hover:bg-on-primary-fixed-variant text-white px-6 py-3 rounded-full font-bold transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95 shadow-md"
                disabled={!canSubmit}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? 'Đang lưu...' : 'Tạo yêu cầu'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-lg flex flex-col items-center justify-center py-12 opacity-50">
            <span className="material-symbols-outlined text-[64px] text-outline mb-2">arrow_back</span>
            <p className="text-sm font-semibold text-on-surface-variant text-center">
              Chọn hóa đơn ở cột bên trái để tiếp tục tạo yêu cầu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SaleCard({ sale, active, onClick }: { sale: SaleListItem; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`w-full flex flex-col p-4 border rounded-xl text-left transition-all outline-none ${
        active
          ? 'border-primary bg-primary-container/10'
          : 'border-outline-variant hover:bg-surface-container-low'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center w-full">
        <strong className="text-on-surface font-bold">#{sale.saleNumber}</strong>
        <span className="text-primary font-bold text-sm">{formatVnd(sale.grandTotal)}</span>
      </div>
      <div className="text-xs text-on-surface-variant mt-1 font-semibold">
        {sale.itemCount} mặt hàng &middot; {sale.cashierName}
      </div>
      <div className="text-[10px] text-on-surface-variant opacity-70 mt-2 font-medium">
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
    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
      {sale.items.map((it) => {
        const p = picks[it.id];
        const checked = !!p;
        return (
          <div key={it.id} className={`p-4 border rounded-xl transition-all ${checked ? 'border-primary bg-primary-container/5' : 'border-outline-variant'}`}>
            <div className="flex justify-between items-start gap-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(it.id, Number(it.quantity))}
                  className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 mt-0.5"
                />
                <div>
                  <strong className="text-on-surface text-sm font-bold block">{it.name}</strong>
                  <span className="text-xs text-on-surface-variant font-medium mt-0.5 block">Đơn giá: {formatVnd(it.unitPrice)} / {it.unit}</span>
                </div>
              </label>
              <span className="text-xs text-on-surface-variant font-bold whitespace-nowrap">
                Đã bán: {Number(it.quantity)} {it.unit}
              </span>
            </div>
            {checked && (
              <div className="mt-3 pt-3 border-t border-outline-variant/50 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                    SL trả:
                    <input
                      type="number"
                      min={0.001}
                      max={Number(it.quantity)}
                      step={1}
                      value={p.qty}
                      onChange={(e) => setQty(it.id, Number(e.target.value), Number(it.quantity))}
                      className="w-16 px-1.5 py-0.5 text-center border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-bold"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.restockable}
                      onChange={(e) => setRestockable(it.id, e.target.checked)}
                      className="rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Hoàn kho</span>
                  </label>
                </div>
                <span className="text-xs text-on-surface-variant">
                  Hoàn: <b className="text-primary text-sm font-bold">{formatVnd(Math.round(it.unitPrice * p.qty))}</b>
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

  if (isLoading) return <p className="text-sm text-on-surface-variant">Đang tải...</p>;
  if (items.length === 0) {
    return (
      <div className="max-w-2xl bg-white rounded-xl border border-outline-variant p-12 flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-[64px] text-tertiary-container mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
        <p className="text-base text-on-surface-variant font-semibold text-center max-w-sm">
          Không có yêu cầu {tabName(upper)} nào.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
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
    <div className="bg-white p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <strong className="text-on-surface font-bold text-base">HD gốc: {ret.originalSale?.saleNumber ?? ret.originalSaleId.slice(0, 8)}</strong>
          <p className="text-sm text-on-surface-variant mt-1 italic">Lý do: "{ret.reason}"</p>
          <p className="text-xs text-on-surface-variant mt-2 opacity-75 font-medium">
            {new Date(ret.createdAt).toLocaleString('vi-VN')} &middot; {ret.cashier?.profile?.fullName ?? ret.cashier?.email ?? '-'}
          </p>
        </div>
        <div className="text-right whitespace-nowrap">
          <strong className="text-primary font-bold text-lg block">{formatVnd(ret.refundAmount)}</strong>
          <p className="text-xs text-on-surface-variant mt-1 font-semibold">
            {ret.items.length} mặt hàng &middot; {ret.items.filter((i) => i.restockable).length} hoàn kho
          </p>
        </div>
      </div>
      {(onApprove || onComplete) && (
        <div className="flex gap-2 justify-end pt-3 border-t border-outline-variant/30">
          {onApprove && (
            <button className="bg-primary hover:bg-on-primary-fixed-variant text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 active:scale-95 shadow-sm" disabled={busy} onClick={onApprove}>
              Duyệt yêu cầu
            </button>
          )}
          {onComplete && (
            <button className="bg-primary hover:bg-on-primary-fixed-variant text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 active:scale-95 shadow-sm" disabled={busy} onClick={onComplete}>
              Hoàn tất (hoàn kho)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
