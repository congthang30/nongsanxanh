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
      setScanOk(`Da them: ${scanned.productName}${scanned.inStock ? '' : ' (canh bao: het ton tai cua hang)'}`);
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
      push('San pham nay chua co ma vach', 'error');
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
      setPayError('Tien khach dua khong du');
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
      push(`Thanh toan thanh cong${paid.changeAmount > 0 ? ` - Tien thoi ${formatVnd(paid.changeAmount)}` : ''}`);
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
      push('Da huy hoa don');
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
      push('Da treo hoa don');
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
        push('Da mo ca ban hang');
      } else {
        await posApi.closeShift(amount, note);
        setShift(null);
        push('Da dong ca ban hang');
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
    <div className="pos-root">
      {/* Top bar */}
      <div className="pos-topbar">
        <div className="pos-brand">
          <span className="pos-brand-dot" />
          NongSan Xanh <span style={{ color: 'var(--pos-muted)', fontWeight: 500 }}>POS</span>
        </div>
        <div className="pos-topbar-info">
          <span>
            Cua hang: <b>{sale?.storeName ?? '...'}</b>
          </span>
          <span>
            Thu ngan: <b>{user?.fullName ?? user?.email}</b>
          </span>
          {shift ? (
            <button className="pos-shift-pill open" onClick={() => setShiftModal('close')}>
              ● Ca dang mo &middot; {formatVnd(shift.expectedCash)}
            </button>
          ) : (
            <button className="pos-shift-pill" onClick={() => setShiftModal('open')}>
              ○ Mo ca ban hang
            </button>
          )}
          {(user?.roles.includes('STORE_MANAGER') ||
            user?.roles.includes('ADMIN') ||
            user?.roles.includes('SUPER_ADMIN')) && (
            <Link to="/pos/returns" className="pos-link-btn">
              Tra hang
            </Link>
          )}
          <Link to="/store" className="pos-link-btn">
            Thoat
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="pos-body">
        {/* LEFT: scan + search */}
        <div className="pos-col pos-col-scan">
          <div className="pos-card pos-scan-wrap">
            <div className="pos-card-title">Quet ma vach / Tim san pham</div>
            <div className="pos-scan-field">
              <span className="pos-scan-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M6 9v6M9 9v6M12 9v6M15 9v6M18 9v6" />
                </svg>
              </span>
              <input
                ref={scanRef}
                className="pos-scan-input pos-tabular"
                value={barcode}
                placeholder="Quet hoac nhap ma vach..."
                disabled={!editable}
                onChange={(e) => runSearch(e.target.value)}
                onKeyDown={onScanKey}
                autoFocus
              />
            </div>
            {scanError && <div className="pos-scan-error">{scanError}</div>}
            {scanOk && !scanError && <div className="pos-scan-ok">{scanOk}</div>}

            {searchResults.length > 0 && (
              <div className="pos-search-list">
                {searchResults.map((r) => (
                  <button
                    key={r.variantId}
                    className="pos-search-item"
                    disabled={!r.inStock}
                    onClick={() => pickSearchResult(r)}
                  >
                    <div>
                      <div className="pos-search-name">{r.productName}</div>
                      <div className="pos-search-meta">
                        {r.sku} &middot; {r.barcode ?? 'chua co ma vach'} &middot; Ton: {r.available} {r.unit}
                        {r.saleMode === 'WEIGHT' ? ' (can ky)' : ''}
                      </div>
                    </div>
                    <b className="pos-tabular">{formatVnd(r.unitPrice)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pos-card" style={{ fontSize: 12, color: 'var(--pos-muted)' }}>
            <div className="pos-card-title">Phim tat</div>
            <div>
              <span className="pos-kbd">Enter</span> Quet &nbsp;
              <span className="pos-kbd">F4</span> Tra tien mat &nbsp;
              <span className="pos-kbd">F6</span> Treo hoa don
            </div>
          </div>
        </div>

        {/* MIDDLE: bill */}
        <div className="pos-col pos-col-bill">
          <div className="pos-card pos-bill-card">
            <div className="pos-card-title">
              Hoa don {sale?.saleNumber ? `#${sale.saleNumber}` : ''} &middot; {sale?.items.length ?? 0} mat hang
            </div>
            <div className="pos-bill-scroll">
              {!sale || sale.items.length === 0 ? (
                <div className="pos-empty">
                  <svg className="pos-empty-icon-svg" viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M6 9v6M9 9v6M12 9v6M15 9v6M18 9v6" />
                  </svg>
                  <div>Quet ma vach de them san pham</div>
                </div>
              ) : (
                sale.items.map((it) => (
                  <div className="pos-item" key={it.id}>
                    <div>
                      <div className="pos-item-name">{it.name}</div>
                      <div className="pos-item-sub">
                        {it.sku} &middot; {formatVnd(it.unitPrice)}/{it.unit}
                      </div>
                    </div>
                    <div className="pos-item-total pos-tabular">{formatVnd(it.lineTotal)}</div>
                    <div className="pos-item-controls">
                      <div className="pos-qty">
                        <button disabled={!editable} onClick={() => changeQty(it.id, it.quantity - 1)}>
                          −
                        </button>
                        <span className="pos-qty-val pos-tabular">
                          {it.quantity} {it.unit}
                        </span>
                        <button disabled={!editable} onClick={() => changeQty(it.id, it.quantity + 1)}>
                          +
                        </button>
                      </div>
                      <button
                        className="pos-item-del"
                        disabled={!editable}
                        onClick={() => {
                          if (
                            it.lineTotal > 100000 || it.quantity > 5
                          ) {
                            if (!confirm(`Xoa "${it.name}" (${it.quantity} ${it.unit} · ${formatVnd(it.lineTotal)})?`)) return;
                          }
                          removeItem(it.id);
                        }}
                        aria-label={`Xoa ${it.name}`}
                        title="Xoa"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: summary + payment */}
        <div className="pos-col pos-col-pay">
          <div className="pos-card">
            <div className="pos-card-title">Thanh toan</div>
            <div className="pos-sum-row">
              <span>Tam tinh</span>
              <b className="pos-tabular">{formatVnd(sale?.subtotal ?? 0)}</b>
            </div>
            {(sale?.discountTotal ?? 0) > 0 && (
              <div className="pos-sum-row">
                <span>Giam gia</span>
                <b className="pos-tabular">-{formatVnd(sale!.discountTotal)}</b>
              </div>
            )}
            <div className="pos-sum-total">
              <span>TONG CONG</span>
              <b className="pos-tabular">{formatVnd(grandTotal)}</b>
            </div>

            {isPaid ? (
              <div className="pos-scan-ok" style={{ marginTop: 16, textAlign: 'center' }}>
                Da thanh toan
                {sale!.changeAmount > 0 && ` · Tien thoi ${formatVnd(sale!.changeAmount)}`}
              </div>
            ) : isVoided ? (
              <div className="pos-pay-error" style={{ marginTop: 16 }}>
                Hoa don da huy
              </div>
            ) : (
              <>
                <div className="pos-pay-methods">
                  {(['CASH', 'VNPAY'] as POSPaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      className={`pos-pay-method ${method === m ? 'active' : ''}`}
                      onClick={() => setMethod(m)}
                    >
                      {PAYMENT_LABELS[m]}
                    </button>
                  ))}
                </div>

                {method === 'CASH' ? (
                  <>
                    <label className="pos-field-label">Tien khach dua</label>
                    <input
                      className="pos-input pos-tabular"
                      type="number"
                      value={cashGiven}
                      placeholder="0"
                      onChange={(e) => setCashGiven(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && doPay()}
                    />
                    <div className="pos-quick-cash">
                      <button onClick={() => setCashGiven(String(grandTotal))}>Dung tien</button>
                      {QUICK_CASH.map((c) => (
                        <button key={c} onClick={() => setCashGiven(String(c))}>
                          {c / 1000}k
                        </button>
                      ))}
                    </div>
                    <div className="pos-change-box">
                      <span>Tien thoi</span>
                      <b className="pos-tabular">{formatVnd(change)}</b>
                    </div>
                  </>
                ) : (
                  <>
                    {method === 'VNPAY' && grandTotal > 0 && (
                      <div className="pos-qr-block">
                        <div className="pos-qr-brand">
                          <span className="pos-qr-brand-vn">VN</span>
                          <span className="pos-qr-brand-pay">PAY</span>
                          <span className="pos-qr-brand-tag">QR</span>
                        </div>
                        {vnpQrLoading || !vnpQr ? (
                          <div className="pos-qr-img pos-qr-loading">
                            <span className="pos-spinner pos-spinner-dark" />
                          </div>
                        ) : (
                          <a
                            href={vnpQr.payUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Mo trang thanh toan tren may cashier (test)"
                          >
                            <img
                              className="pos-qr-img"
                              src={vnpQr.imageUrl}
                              alt="QR thanh toan VNPay"
                            />
                          </a>
                        )}
                        <div className="pos-qr-info">
                          <span className="pos-qr-line">
                            So tien: <b className="pos-tabular">{formatVnd(grandTotal)}</b>
                          </span>
                          <span className="pos-qr-line">
                            Ma don: {vnpQr?.saleNumber ?? sale?.saleNumber}
                          </span>
                          <span className="pos-qr-line pos-qr-hint">
                            Khach mo app VNPay / ngan hang &gt; quet QR &gt; xac nhan.
                          </span>
                        </div>
                      </div>
                    )}
                    <label className="pos-field-label">Ma tham chieu (tuy chon)</label>
                    <input
                      className="pos-input"
                      style={{ fontSize: 14 }}
                      value={reference}
                      placeholder="Ma giao dich / noi dung CK"
                      onChange={(e) => setReference(e.target.value)}
                    />
                    <p style={{ fontSize: 12, color: 'var(--pos-muted)', marginTop: 8 }}>
                      Cashier xac nhan da nhan tien truoc khi bam thanh toan.
                    </p>
                  </>
                )}

                {payError && <div className="pos-pay-error">{payError}</div>}

                <button
                  className="pos-btn pos-btn-primary pos-btn-pay"
                  disabled={paying || !sale || sale.items.length === 0}
                  onClick={doPay}
                >
                  {paying ? <span className="pos-spinner" /> : `Thanh toan ${formatVnd(grandTotal)}`}
                </button>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="pos-card">
            {isPaid || isVoided ? (
              <div className="pos-btn-row">
                <button className="pos-btn" onClick={showReceipt} disabled={!isPaid}>
                  In hoa don
                </button>
                <button className="pos-btn pos-btn-primary" onClick={startNewSale} disabled={busy}>
                  Hoa don moi
                </button>
              </div>
            ) : (
              <div className="pos-btn-row">
                <button className="pos-btn" onClick={doHold} disabled={!sale || sale.items.length === 0}>
                  Treo
                </button>
                <button
                  className="pos-btn pos-btn-danger"
                  onClick={() => setVoidModal(true)}
                  disabled={!sale}
                >
                  Huy don
                </button>
                <button className="pos-btn" onClick={startNewSale} disabled={busy}>
                  Don moi
                </button>
              </div>
            )}
          </div>
        </div>
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
          title="Huy hoa don"
          subtitle={`Hoa don ${sale?.saleNumber}. Nhap ly do huy.`}
          confirmLabel="Huy hoa don"
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
