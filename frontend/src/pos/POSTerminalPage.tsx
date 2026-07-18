import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../lib/auth.store';
import { useToastStore } from '../lib/toast.store';
import { formatVnd } from '../lib/format';
import { getErrorMessage } from '../lib/api';
import {
  posApi,
  BarcodeLookup,
  CashierShift,
  POSSale,
  POSPaymentMethod,
  PAYMENT_LABELS,
  ReceiptData,
} from './pos.api';
import { WeightModal } from './components/WeightModal';
import { ReasonModal } from './components/ReasonModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ShiftModal } from './components/ShiftModal';
import { fetchPosVnpayQR, PosVnpayQR } from '../lib/pos-qr';
import './pos.css';

const QUICK_CASH = [50000, 100000, 200000, 500000];

export default function POSTerminalPage() {
  const { user } = useAuthStore();
  const { push } = useToastStore();

  const [shift, setShift] = useState<CashierShift | null>(null);
  const [sale, setSale] = useState<POSSale | null>(null);
  const [barcode, setBarcode] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanOk, setScanOk] = useState('');
  const [searchResults, setSearchResults] = useState<BarcodeLookup[]>([]);
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<POSPaymentMethod>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [reference, setReference] = useState('');
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  const [weightModal, setWeightModal] = useState<BarcodeLookup | null>(null);
  const [voidModal, setVoidModal] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [shiftModal, setShiftModal] = useState<'open' | 'close' | null>(null);
  const [shiftBusy, setShiftBusy] = useState(false);

  const [vnpQr, setVnpQr] = useState<PosVnpayQR | null>(null);
  const [vnpQrLoading, setVnpQrLoading] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);

  const focusScan = useCallback(() => {
    setTimeout(() => scanRef.current?.focus(), 30);
  }, []);

  // ----- Init: load shift + create/open draft sale -----
  useEffect(() => {
    (async () => {
      try {
        const s = await posApi.currentShift();
        setShift(s);
        const draft = await posApi.createSale();
        setSale(draft);
        if (s) setShift(await posApi.currentShift());
        focusScan();
      } catch (e) {
        push(getErrorMessage(e), 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grandTotal = sale?.grandTotal ?? 0;
  const cashNum = parseInt(cashGiven || '0', 10);
  const change = method === 'CASH' ? Math.max(0, cashNum - grandTotal) : 0;

  // ----- New sale -----
  const startNewSale = async () => {
    try {
      setBusy(true);
      const draft = await posApi.createSale();
      setSale(draft);
      setCashGiven('');
      setReference('');
      setPayError('');
      setScanError('');
      setScanOk('');
      setSearchResults([]);
      setShift(await posApi.currentShift());
      focusScan();
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // ----- Scan -----
  const doScan = async (code: string, quantity?: number) => {
    if (!sale || !code.trim()) return;
    setScanError('');
    setScanOk('');
    try {
      // Peek lookup to detect WEIGHT before scanning
      if (quantity === undefined) {
        const found = await posApi.lookup(code.trim());
        if (found.saleMode === 'WEIGHT') {
          setWeightModal(found);
          setBarcode('');
          return;
        }
      }
      const { sale: updated, scanned } = await posApi.scan(sale.id, code.trim(), quantity);
      setSale(updated);
      setScanOk(`Đã thêm: ${scanned.productName}${scanned.inStock ? '' : ' (cảnh báo: hết tồn tại cửa hàng)'}`);
      setBarcode('');
      setSearchResults([]);
      focusScan();
    } catch (e) {
      setScanError(getErrorMessage(e));
      setBarcode('');
      focusScan();
    }
  };

  const onScanKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcode.trim()) doScan(barcode);
    }
  };

  // ----- Manual search -----
  const runSearch = async (q: string) => {
    setBarcode(q);
    setScanError('');
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await posApi.search(q.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  const pickSearchResult = (item: BarcodeLookup) => {
    if (!item.barcode) {
      push('Sản phẩm này chưa có mã vạch', 'error');
      return;
    }
    if (item.saleMode === 'WEIGHT') {
      setWeightModal(item);
      setSearchResults([]);
      setBarcode('');
      return;
    }
    doScan(item.barcode);
  };

  // ----- Item edits -----
  const changeQty = async (itemId: string, qty: number) => {
    if (!sale || qty < 1) return;
    try {
      setSale(await posApi.updateItem(sale.id, itemId, qty));
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!sale) return;
    try {
      setSale(await posApi.removeItem(sale.id, itemId));
      focusScan();
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  // ----- Pay -----
  const doPay = async () => {
    if (!sale || sale.items.length === 0) return;
    setPayError('');
    if (method === 'CASH' && cashNum < grandTotal) {
      setPayError('Tiền khách đưa không đủ');
      return;
    }
    try {
      setPaying(true);
      const payments =
        method === 'CASH'
          ? [{ method, amount: grandTotal, tendered: cashNum }]
          : [{ method, amount: grandTotal, reference: reference || undefined }];
      const paid = await posApi.pay(sale.id, payments);
      setSale(paid);
      push(`Thanh toán thành công${paid.changeAmount > 0 ? ` - Tiền thối ${formatVnd(paid.changeAmount)}` : ''}`);
      // Auto open receipt
      const r = await posApi.receipt(paid.id);
      setReceipt(r);
    } catch (e) {
      setPayError(getErrorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  // ----- Void -----
  const doVoid = async (reason: string) => {
    if (!sale) return;
    try {
      await posApi.voidSale(sale.id, reason);
      push('Đã hủy hóa đơn');
      setVoidModal(false);
      startNewSale();
    } catch (e) {
      push(getErrorMessage(e), 'error');
      setVoidModal(false);
    }
  };

  // ----- Hold / receipt -----
  const doHold = async () => {
    if (!sale) return;
    try {
      await posApi.hold(sale.id);
      push('Đã treo hóa đơn');
      startNewSale();
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  const showReceipt = async () => {
    if (!sale) return;
    try {
      setReceipt(await posApi.receipt(sale.id));
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  // ----- Shift -----
  const handleShift = async (amount: number, note?: string) => {
    try {
      setShiftBusy(true);
      if (shiftModal === 'open') {
        const s = await posApi.openShift(amount, note);
        setShift(s);
        push('Đã mở ca bán hàng');
      } else {
        await posApi.closeShift(amount, note);
        setShift(null);
        push('Đã đóng ca bán hàng');
      }
      setShiftModal(null);
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setShiftBusy(false);
    }
  };

  // ----- Keyboard shortcuts -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        setMethod('CASH');
        if (sale && sale.status === 'DRAFT' && sale.items.length > 0) doPay();
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (sale && sale.items.length > 0) doHold();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale, method, cashGiven]);

  // ----- VNPay QR: fetch URL signed tu backend khi cashier chon VNPAY -----
  useEffect(() => {
    if (
      method !== 'VNPAY' ||
      !sale ||
      sale.status !== 'DRAFT' ||
      sale.items.length === 0 ||
      sale.grandTotal <= 0
    ) {
      setVnpQr(null);
      setVnpQrLoading(false);
      return;
    }
    let cancelled = false;
    setVnpQrLoading(true);
    fetchPosVnpayQR(sale.id)
      .then((data) => { if (!cancelled) setVnpQr(data); })
      .catch((e) => { if (!cancelled) push(getErrorMessage(e), 'error'); })
      .finally(() => { if (!cancelled) setVnpQrLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, sale?.id, sale?.grandTotal, sale?.status, sale?.items.length]);

  const isPaid = sale?.status === 'PAID';
  const isVoided = sale?.status === 'VOIDED';
  const editable = sale?.status === 'DRAFT' || sale?.status === 'HELD';

  return (
    <div className="bg-surface text-on-surface overflow-hidden h-screen flex w-full">
      {/* Top App Bar / Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-outline-variant h-16 flex items-center px-lg justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link 
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-label-bold text-label-bold font-semibold outline-none"
            to="/store"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Về trang khách
          </Link>
        </div>
        <h1 className="font-headline-md text-headline-md text-primary font-bold absolute left-1/2 transform -translate-x-1/2">
          Quầy bán hàng (POS)
        </h1>
        <div className="flex items-center gap-4">
          {/* Placeholder for trailing actions */}
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-full w-full">
        {/* SideNavBar Section */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-surface-container-low border-r border-outline-variant shadow-md flex flex-col py-lg z-40 hidden md:flex">
          {/* Navigation Links */}
          <nav className="flex-1 px-4 space-y-2">
            <button className="w-[calc(100%-1rem)] flex items-center gap-3 px-4 py-3 bg-primary-container/20 text-primary rounded-lg mx-2 my-1 font-label-bold text-label-bold transition-all font-semibold text-left" onClick={startNewSale}>
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>point_of_sale</span>
              <span className="font-label-bold text-label-bold font-semibold text-primary">Bán hàng mới</span>
            </button>
            <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-lg mx-2 my-1 font-label-bold text-label-bold transition-all hover:bg-primary-container/20 font-semibold" to="/pos/returns">
              <span className="material-symbols-outlined">receipt_long</span>
              <span className="font-label-bold text-label-bold font-semibold">Trả hàng / Lịch sử</span>
            </Link>
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed" title="Sắp ra mắt">
              <span className="material-symbols-outlined">inventory_2</span>
              <span className="font-label-bold text-label-bold font-semibold">Kiểm tồn</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed" title="Sắp ra mắt">
              <span className="material-symbols-outlined">groups</span>
              <span className="font-label-bold text-label-bold font-semibold">Khách hàng</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed" title="Sắp ra mắt">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span className="font-label-bold text-label-bold font-semibold">Quản trị</span>
            </div>
          </nav>
          {/* Footer Actions */}
          <div className="px-4 mt-auto space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-lg mx-2 my-1 font-label-bold text-label-bold font-semibold cursor-not-allowed" title="Sắp ra mắt">
              <span className="material-symbols-outlined">help</span>
              <span className="font-label-bold text-label-bold font-semibold">Trợ giúp</span>
            </div>
            <Link to="/store" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-lg mx-2 my-1 font-label-bold text-label-bold transition-all hover:bg-primary-container/20 font-semibold">
              <span className="material-symbols-outlined text-on-surface-variant">logout</span>
              <span className="font-label-bold text-label-bold font-semibold">Thoát quầy</span>
            </Link>
            <div className="mt-4 px-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary font-bold border border-outline-variant">
                  {user?.fullName?.slice(0, 2).toUpperCase() ?? 'TN'}
                </div>
                <div>
                  <p className="font-label-bold text-label-bold text-on-surface font-bold">Quầy 01</p>
                  <p className="text-xs text-on-surface-variant">Thu ngân: {user?.fullName ?? user?.email}</p>
                </div>
              </div>
              {shift ? (
                <button 
                  className="w-full py-2 px-4 bg-outline-variant text-on-surface font-label-bold font-semibold rounded-lg hover:bg-outline transition-colors"
                  onClick={() => setShiftModal('close')}
                >
                  Đóng ca
                </button>
              ) : (
                <button 
                  className="w-full py-2 px-4 bg-primary text-white font-label-bold font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                  onClick={() => setShiftModal('open')}
                >
                  Mở ca
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 ml-64 flex flex-col h-full bg-surface">

        {/* POS Canvas */}
        <div className="flex-1 flex overflow-hidden p-md gap-md">
          {/* Left: Transaction Area */}
          <div className="flex-1 flex flex-col gap-md">
            {/* Search & Scan */}
            <div className="bg-white p-4 rounded-xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,110,47,0.03)] flex gap-4 items-center relative">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">barcode_scanner</span>
                <input
                  ref={scanRef}
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-full focus:ring-2 focus:ring-primary text-body-md transition-all outline-none"
                  value={barcode}
                  placeholder="Quét mã vạch hoặc tìm tên sản phẩm (F1)..."
                  disabled={!editable}
                  onChange={(e) => runSearch(e.target.value)}
                  onKeyDown={onScanKey}
                />
              </div>
              <button
                className="bg-primary text-white p-3 rounded-full hover:bg-on-primary-fixed-variant transition-colors active:scale-95 shadow-md flex items-center justify-center"
                disabled={!editable}
                onClick={() => barcode.trim() && doScan(barcode)}
              >
                <span className="material-symbols-outlined text-white">search</span>
              </button>

              {searchResults.length > 0 && (
                <div className="absolute left-4 right-4 top-full mt-2 bg-white border border-outline-variant rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                  {searchResults.map((r) => (
                    <button
                      key={r.variantId}
                      className="w-full flex items-center justify-between p-3 hover:bg-surface-container-low rounded-lg text-left transition-colors"
                      disabled={!r.inStock}
                      onClick={() => pickSearchResult(r)}
                    >
                      <div>
                        <div className="font-bold text-on-surface text-sm">{r.productName}</div>
                        <div className="text-xs text-on-surface-variant">
                          {r.sku} &middot; Tồn: {r.available} {r.unit} {r.saleMode === 'WEIGHT' ? ' (cân ký)' : ''}
                        </div>
                      </div>
                      <b className="text-primary text-sm">{formatVnd(r.unitPrice)}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {scanError && <div className="text-error bg-error-container/20 border border-error/30 px-4 py-2 rounded-lg text-xs font-semibold">{scanError}</div>}
            {scanOk && !scanError && <div className="text-primary bg-primary-container/10 border border-primary-container/25 px-4 py-2 rounded-lg text-xs font-semibold">{scanOk}</div>}

            {/* Product List / Cart Container */}
            <div className="flex-grow bg-white rounded-xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,110,47,0.03)] flex flex-col overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-6 py-4 bg-surface-container border-b border-outline-variant text-label-bold text-on-surface-variant uppercase tracking-wider text-[11px] font-bold">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">Sản phẩm</div>
                <div className="col-span-2 text-center">Số lượng</div>
                <div className="col-span-2 text-right">Đơn giá</div>
                <div className="col-span-2 text-right">Thành tiền</div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {!sale || sale.items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 py-12">
                    <div className="w-32 h-32 mb-4">
                      <img
                        className="w-full h-full object-contain"
                        alt="Giỏ hàng trống"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_0Q2B53Ec9TNjFSwSKfLwaEAll447J7lA1fDayj3If0MkMG_SjtwF-gc2tGsIi5papVKU4ogZv0_vBb862ISatSfYaXIKjpb6aZEyn9tApV_TGqnuvbh4zQuNCrs4OgmUsjC04duy7wwPHfm125xBuWVhvbnxZ83OSMoJlWIeNQyyahBgSsyfz39StmgFyiSlmKzIeJhGOXgjTobqvva4kICZa9c1obpDNUq2uRRMK0wpfMGTuk-PmQ"
                      />
                    </div>
                    <p className="font-headline-md text-outline font-bold text-lg">Chưa có sản phẩm nào</p>
                    <p className="text-body-md text-outline">Quét sản phẩm để bắt đầu hóa đơn mới</p>
                  </div>
                ) : (
                  sale.items.map((it, idx) => (
                    <div className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-outline-variant/30 items-center text-body-md" key={it.id}>
                      <div className="col-span-1 text-center font-bold text-on-surface-variant">{idx + 1}</div>
                      <div className="col-span-5">
                        <div className="font-bold text-on-surface">{it.name}</div>
                        <div className="text-xs text-on-surface-variant">{it.sku}</div>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <div className="flex items-center border border-outline-variant rounded-lg bg-surface-container-low overflow-hidden">
                          <button className="px-2 py-1 hover:bg-surface-container-high font-bold transition-colors" disabled={!editable} onClick={() => changeQty(it.id, it.quantity - 1)}>
                            −
                          </button>
                          <span className="px-3 font-bold text-sm">
                            {it.quantity} {it.unit}
                          </span>
                          <button className="px-2 py-1 hover:bg-surface-container-high font-bold transition-colors" disabled={!editable} onClick={() => changeQty(it.id, it.quantity + 1)}>
                            +
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-medium text-on-surface-variant">{formatVnd(it.unitPrice)}</div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <span className="font-bold text-on-surface">{formatVnd(it.lineTotal)}</span>
                        <button
                          className="text-error hover:bg-error-container p-1 rounded-md transition-colors"
                          disabled={!editable}
                          onClick={() => {
                            if (it.lineTotal > 100000 || it.quantity > 5) {
                              if (!confirm(`Xóa "${it.name}" (${it.quantity} ${it.unit} · ${formatVnd(it.lineTotal)})?`)) return;
                            }
                            removeItem(it.id);
                          }}
                          aria-label={`Xóa ${it.name}`}
                          title="Xóa"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Foot Functions */}
              <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-between items-center">
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white border border-outline-variant text-on-surface rounded-lg font-label-bold hover:bg-surface-container-high transition-all flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">person_add</span> Khách hàng
                  </button>
                  <button className="px-4 py-2 bg-white border border-outline-variant text-on-surface rounded-lg font-label-bold hover:bg-surface-container-high transition-all flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">sell</span> Giảm giá
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-label-bold hover:bg-amber-100 transition-all flex items-center gap-1 disabled:opacity-50"
                    disabled={!sale || sale.items.length === 0}
                    onClick={doHold}
                  >
                    <span className="material-symbols-outlined text-[18px]">pause</span> Treo đơn
                  </button>
                  <button
                    className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-label-bold hover:bg-red-100 transition-all flex items-center gap-1 disabled:opacity-50"
                    disabled={!sale}
                    onClick={() => setVoidModal(true)}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span> Hủy đơn
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Checkout Sidebar */}
          <div className="w-[400px] flex flex-col gap-md">
            {/* Summary Card */}
            <div className="bg-white p-6 rounded-xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,110,47,0.03)] space-y-4">
              <div className="flex justify-between items-center text-on-surface-variant">
                <span className="text-body-md">Tạm tính ({sale?.items.length ?? 0} SP)</span>
                <span className="font-bold text-on-surface">{formatVnd(sale?.subtotal ?? 0)}</span>
              </div>
              {(sale?.discountTotal ?? 0) > 0 && (
                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="text-body-md">Khuyến mãi</span>
                  <span className="font-bold text-red-500">-{formatVnd(sale!.discountTotal)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-outline-variant flex justify-between items-end">
                <span className="font-label-bold text-lg font-bold text-on-surface">TỔNG CỘNG</span>
                <span className="text-display-lg font-display-lg text-primary font-bold leading-none tracking-tight">{formatVnd(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white p-6 rounded-xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,110,47,0.03)] flex flex-col gap-4">
              <h3 className="text-label-bold text-on-surface-variant font-bold">Phương thức thanh toán</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                    method === 'CASH' ? 'border-primary bg-primary-container/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/50'
                  }`}
                  onClick={() => setMethod('CASH')}
                >
                  <span className="material-symbols-outlined mb-2 text-[24px]" style={{ fontVariationSettings: method === 'CASH' ? "'FILL' 1" : "'FILL' 0" }}>payments</span>
                  <span className="font-label-bold text-sm font-semibold">Tiền mặt</span>
                </button>
                <button
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                    method === 'VNPAY' ? 'border-primary bg-primary-container/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/50'
                  }`}
                  onClick={() => setMethod('VNPAY')}
                >
                  <span className="material-symbols-outlined mb-2 text-[24px]">qr_code_2</span>
                  <span className="font-label-bold text-sm font-semibold">VNPay</span>
                </button>
              </div>
            </div>

            {/* Cash Processing / QR block */}
            <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col gap-4">
              {isPaid ? (
                <div className="text-primary bg-primary-container/10 border border-primary-container/30 px-4 py-3 rounded-lg text-center font-bold">
                  Đã thanh toán {formatVnd(sale!.grandTotal)}
                  {sale!.changeAmount > 0 && ` (Tiền thừa: ${formatVnd(sale!.changeAmount)})`}
                </div>
              ) : isVoided ? (
                <div className="text-error bg-error-container/20 border border-error/30 px-4 py-3 rounded-lg text-center font-bold">
                  Hóa đơn đã hủy
                </div>
              ) : method === 'CASH' ? (
                <>
                  <div>
                    <label className="block text-label-sm font-label-bold text-on-surface-variant mb-2 font-bold uppercase">TIỀN KHÁCH ĐƯA</label>
                    <input
                      className="w-full text-right py-4 px-4 bg-white border-none rounded-lg text-headline-md font-headline-md font-bold focus:ring-2 focus:ring-primary shadow-inner outline-none"
                      type="number"
                      value={cashGiven}
                      placeholder="0"
                      onChange={(e) => setCashGiven(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && doPay()}
                    />
                  </div>
                  {/* Quick Denominations */}
                  <div className="grid grid-cols-5 gap-2">
                    <button className="py-2 px-1 bg-white border border-outline-variant rounded-lg text-[11px] font-bold hover:bg-primary hover:text-white transition-colors" onClick={() => setCashGiven(String(grandTotal))}>Đúng</button>
                    {QUICK_CASH.map((c) => (
                      <button key={c} className="py-2 px-1 bg-white border border-outline-variant rounded-lg text-[11px] font-bold hover:bg-primary hover:text-white transition-colors" onClick={() => setCashGiven(String(c))}>
                        {c / 1000}k
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-label-bold text-on-surface-variant font-bold">TIỀN THỪA</span>
                    <span className="text-headline-md font-headline-md text-on-surface font-bold">{formatVnd(change)}</span>
                  </div>
                </>
              ) : (
                <>
                  {method === 'VNPAY' && grandTotal > 0 && (
                    <div className="flex flex-col items-center gap-3 py-2">
                      {vnpQrLoading || !vnpQr ? (
                        <div className="w-32 h-32 flex items-center justify-center bg-white p-2 rounded-lg border border-outline-variant">
                          <span className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                        </div>
                      ) : (
                        <a href={vnpQr.payUrl} target="_blank" rel="noopener noreferrer" title="Mở cổng VNPay (thử nghiệm thu ngân)">
                          <img className="w-32 h-32 object-contain bg-white p-2 rounded-lg border border-outline-variant" src={vnpQr.imageUrl} alt="VNPay QR" />
                        </a>
                      )}
                      <div className="text-center text-xs text-on-surface-variant">
                        <div>Số tiền: <b className="text-on-surface">{formatVnd(grandTotal)}</b></div>
                        <div>Mã đơn: <span className="text-on-surface font-semibold">{vnpQr?.saleNumber ?? sale?.saleNumber}</span></div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-label-sm font-label-bold text-on-surface-variant mb-2 font-bold uppercase">Mã tham chiếu (tùy chọn)</label>
                    <input
                      className="w-full py-3 px-4 bg-white border-none rounded-lg text-sm focus:ring-2 focus:ring-primary shadow-inner outline-none"
                      value={reference}
                      placeholder="Mã giao dịch / nội dung chuyển khoản..."
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </>
              )}

              {payError && <div className="text-error bg-error-container/20 border border-error/30 px-4 py-2 rounded-lg text-xs font-semibold">{payError}</div>}
            </div>

            {/* Primary Action */}
            <div className="flex flex-col gap-2 mt-auto">
              {isPaid || isVoided ? (
                <>
                  <button className="w-full bg-primary text-white py-5 rounded-xl font-headline-md text-headline-md hover:bg-on-primary-fixed-variant transition-all active:scale-95 flex items-center justify-center gap-3 font-bold disabled:opacity-50" onClick={showReceipt} disabled={!isPaid}>
                    <span className="material-symbols-outlined text-[28px]">print</span>
                    IN HÓA ĐƠN
                  </button>
                  <button className="w-full bg-white border-2 border-primary text-primary py-4 rounded-xl font-label-bold hover:bg-primary-container/10 transition-all active:scale-95 font-semibold" onClick={startNewSale}>
                    ĐƠN MỚI
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="w-full bg-primary text-white py-5 rounded-xl font-headline-md text-headline-md hover:bg-on-primary-fixed-variant transition-all active:scale-95 flex items-center justify-center gap-3 font-bold disabled:opacity-50 shadow-md"
                    disabled={paying || !sale || sale.items.length === 0}
                    onClick={doPay}
                  >
                    {paying ? (
                      <span className="animate-spin rounded-full h-7 w-7 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[28px]">check_circle</span>
                        THANH TOÁN (F12)
                      </>
                    )}
                  </button>
                  <button className="w-full bg-white border-2 border-primary text-primary py-4 rounded-xl font-label-bold hover:bg-primary-container/10 transition-all active:scale-95 font-semibold" onClick={startNewSale}>
                    ĐƠN MỚI (F2)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>

      {/* Hotkey Info Tooltip (Bottom Fixed) */}
      <div className="fixed bottom-4 left-64 px-lg py-2 bg-inverse-surface/80 backdrop-blur-md text-white rounded-full text-[10px] uppercase font-bold flex gap-4 tracking-widest pointer-events-none opacity-60 z-30">
        <span>F1: Tìm kiếm</span>
        <span>F2: Đơn mới</span>
        <span>F12: Thanh toán</span>
        <span>ESC: Hủy đơn</span>
      </div>

      {/* Modals */}
      {weightModal && (
        <WeightModal
          product={weightModal}
          onConfirm={(qty) => {
            const code = weightModal.barcode;
            setWeightModal(null);
            doScan(code, qty);
          }}
          onClose={() => {
            setWeightModal(null);
            focusScan();
          }}
        />
      )}
      {voidModal && (
        <ReasonModal
          title="Hủy hóa đơn"
          subtitle={`Hóa đơn ${sale?.saleNumber}. Nhập lý do hủy.`}
          confirmLabel="Hủy hóa đơn"
          onConfirm={doVoid}
          onClose={() => setVoidModal(false)}
        />
      )}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {shiftModal && (
        <ShiftModal
          mode={shiftModal}
          shift={shift}
          loading={shiftBusy}
          onConfirm={handleShift}
          onClose={() => setShiftModal(null)}
        />
      )}
    </div>
  );
}
