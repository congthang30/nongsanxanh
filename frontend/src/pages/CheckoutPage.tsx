import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { useCartStore } from '../lib/cart.store';
import { useStoreContext } from '../lib/store.store';
import { useToastStore } from '../lib/toast.store';
import { formatVnd } from '../lib/format';
import './checkout.css';

interface Address {
  id: string; recipientName: string; phone: string;
  province: string; district: string; ward: string; line1: string;
  isDefault: boolean; lat?: number | null; lng?: number | null;
  formattedAddress?: string | null;
}
interface FeeLine { label: string; amount: number; }
interface QuoteStore {
  id: string; name: string; code: string;
  province: string; district: string | null; distanceKm: number | null;
}
interface Quote {
  serviceable: boolean;
  reason: string;
  message?: string;
  store: QuoteStore | null;
  items?: { id: string; name: string; quantity: number; lineTotal: number; inStock: boolean; available: number }[];
  inventoryWarnings?: { variantId: string; name: string; available: number }[];
  subtotal: number;
  shippingFee: number;
  shippingBreakdown?: FeeLine[];
  distanceKm?: number;
  etaText?: string | null;
  discountTotal: number;
  coupon: string | null;
  grandTotal: number;
}
interface Prediction { placeId: string; description: string; }

export default function CheckoutPage() {
  const { items, storeName, subtotal, hasIssues, fetch } = useCartStore();
  const { setStore } = useStoreContext();
  const { push } = useToastStore();
  const navigate = useNavigate();

  const [addressId, setAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'VNPAY'>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);

  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [resolving, setResolving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<{ placeId: string; formattedAddress: string; lat: number; lng: number } | null>(null);
  const [addressDetail, setAddressDetail] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressRef = useRef(false);

  const { data: addresses, refetch: refetchAddr } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/me/addresses').then((r) => r.data.data as Address[]),
  });

  useEffect(() => { fetch().catch(() => {}); }, [fetch]);
  useEffect(() => {
    if (addresses && addresses.length > 0 && !addressId) {
      setAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0].id);
    }
  }, [addresses, addressId]);

  // Quote: resolve store + tinh phi theo dia chi
  useEffect(() => {
    if (items.length === 0 || !addressId) { setQuote(null); return; }
    api
      .post('/cart/checkout/quote', { addressId, paymentMethod, couponCode: couponCode || undefined })
      .then((r) => {
        const q = r.data.data as Quote;
        setQuote(q);
        if (q.serviceable && q.store) {
          setStore({ id: q.store.id, name: q.store.name, code: q.store.code, province: q.store.province, district: q.store.district });
        }
      })
      .catch(() => setQuote(null));
  }, [items.length, addressId, couponCode, paymentMethod, setStore]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suppressRef.current) { suppressRef.current = false; setSearching(false); return; }
    if (search.trim().length < 2) { setPredictions([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/geo/autocomplete', { params: { input: search } });
        setPredictions(data.data.predictions as Prediction[]);
      } catch {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const pickPrediction = async (p: Prediction) => {
    setResolving(true);
    setPredictions([]);
    suppressRef.current = true;
    setSearch(p.description);
    try {
      const { data } = await api.post('/geo/geocode', { placeId: p.placeId, text: p.description });
      const geo = data.data;
      if (!geo) { push('Khong lay duoc toa do dia chi nay', 'error'); return; }
      setPicked({ placeId: geo.placeId, formattedAddress: geo.formattedAddress, lat: geo.lat, lng: geo.lng });
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setResolving(false);
    }
  };

  const saveAddress = async () => {
    if (!recipientName || !phone) { push('Nhap ten nguoi nhan va SDT', 'error'); return; }
    if (!picked) { push('Hay chon khu vuc tu goi y ban do', 'error'); return; }
    const detail = addressDetail.trim();
    const fullAddress = detail ? `${detail}, ${picked.formattedAddress}` : picked.formattedAddress;
    const { province, district, ward } = extractParts(picked.formattedAddress);
    try {
      await api.post('/users/me/addresses', {
        recipientName, phone,
        province: province || picked.formattedAddress,
        district: district || '-', ward: ward || '-',
        line1: detail || picked.formattedAddress,
        formattedAddress: fullAddress,
        placeId: picked.placeId, lat: picked.lat, lng: picked.lng,
        isDefault: true,
      });
      push('Da them dia chi');
      setShowAddrForm(false);
      setRecipientName(''); setPhone(''); setSearch(''); setPicked(null); setAddressDetail('');
      refetchAddr();
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  const placeOrder = async () => {
    if (!addressId) { push('Vui long chon dia chi giao hang', 'error'); return; }
    if (quote && !quote.serviceable) {
      push('Khu vuc nay chua co cua hang phuc vu day du', 'error');
      return;
    }
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', {
        addressId, paymentMethod,
        couponCode: couponCode || undefined, note: note || undefined,
      });
      const order = data.data;
      if (paymentMethod === 'VNPAY') {
        const pay = await api.post('/payments', { orderId: order.id });
        window.location.href = pay.data.data.paymentUrl;
        return;
      }
      push('Dat hang thanh cong!');
      await fetch().catch(() => {});
      navigate(`/orders/${order.id}`);
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container section">
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">Gio hang trong. Hay them san pham truoc khi dat hang.</p>
        </div>
      </div>
    );
  }

  const notServiceable = quote != null && !quote.serviceable;

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 24 }}>Thanh toan</h1>

      <div className="checkout-layout">
        <div className="stack gap-lg">
          {/* Address */}
          <section className="card checkout-block">
            <div className="between">
              <h3>Dia chi giao hang</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddrForm((s) => !s)}>
                {showAddrForm ? 'Dong' : '+ Them dia chi'}
              </button>
            </div>
            {showAddrForm && (
              <div className="addr-form">
                <div className="addr-grid">
                  <input className="input" placeholder="Nguoi nhan" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                  <input className="input" placeholder="So dien thoai" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <label className="addr-label">Khu vuc (duong / phuong / quan)</label>
                <div className="addr-autocomplete">
                  <input
                    className="input"
                    placeholder="Go ten duong roi chon tu goi y (vd: Le Duan, Quan 1)..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
                    autoComplete="off"
                  />
                  {search.trim().length >= 2 && !picked && (
                    <div className="addr-predictions">
                      {searching && <div className="addr-pred-hint">Dang tim dia chi...</div>}
                      {!searching && predictions.map((p) => (
                        <button key={p.placeId} className="addr-pred" onClick={() => pickPrediction(p)}>
                          {p.description}
                        </button>
                      ))}
                      {!searching && predictions.length === 0 && (
                        <div className="addr-pred-hint">Khong tim thay. Thu nhap chi tiet hon.</div>
                      )}
                    </div>
                  )}
                </div>
                {resolving && <p className="muted">Dang lay toa do...</p>}
                {picked && (
                  <>
                    <div className="addr-verified">
                      Khu vuc: {picked.formattedAddress}
                      <span className="muted"> ({picked.lat.toFixed(4)}, {picked.lng.toFixed(4)})</span>
                    </div>
                    <label className="addr-label">So nha / hem / chi tiet</label>
                    <input
                      className="input"
                      placeholder="vd: 8/10/5 duong so 21, tang 2..."
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                    />
                  </>
                )}
                <button className="btn btn-dark btn-sm" onClick={saveAddress} disabled={!picked} style={{ marginTop: 12 }}>Luu dia chi</button>
              </div>
            )}
            <div className="stack gap-sm" style={{ marginTop: 12 }}>
              {addresses?.map((a) => (
                <label key={a.id} className={`addr-option ${addressId === a.id ? 'selected' : ''}`}>
                  <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <div>
                    <strong>{a.recipientName}</strong> · {a.phone}
                    <div className="muted">{a.formattedAddress ?? `${a.line1}, ${a.ward}, ${a.district}, ${a.province}`}</div>
                    {a.lat == null && <div className="addr-warn">Chua co toa do xac thuc</div>}
                  </div>
                </label>
              ))}
              {addresses?.length === 0 && !showAddrForm && (
                <p className="muted">Chua co dia chi. Hay them dia chi giao hang.</p>
              )}
            </div>
          </section>

          {/* Store fulfillment */}
          <section className="card checkout-block">
            <h3>Cua hang phuc vu</h3>
            {!addressId && <p className="muted" style={{ marginTop: 8 }}>Chon dia chi de he thong tim cua hang gan nhat.</p>}
            {quote && quote.serviceable && quote.store && (
              <div className="card" style={{ padding: 14, marginTop: 12, background: '#f0fdf4', borderColor: '#86efac' }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <strong>🏪 {quote.store.name}</strong>
                  <span className="pill pill-green">Phuc vu khu vuc cua ban</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {quote.store.district ? `${quote.store.district}, ` : ''}{quote.store.province}
                  {quote.distanceKm != null && <> · cach ~{quote.distanceKm.toFixed(1)} km</>}
                  {quote.etaText && <> · {quote.etaText}</>}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  Phi giao: <strong>{quote.shippingFee === 0 ? 'Mien phi' : formatVnd(quote.shippingFee)}</strong>
                </div>
              </div>
            )}
            {notServiceable && (
              <div className="card" style={{ padding: 14, marginTop: 12, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
                {quote?.message ?? 'Khu vuc nay chua duoc cua hang nao phuc vu day du.'}
              </div>
            )}
            {quote?.inventoryWarnings && quote.inventoryWarnings.length > 0 && (
              <div className="card" style={{ padding: 12, marginTop: 10, background: '#fffbeb', borderColor: '#fcd34d', fontSize: 13 }}>
                ⚠️ Mot so san pham khong du ton tai cua hang nay:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {quote.inventoryWarnings.map((w) => (
                    <li key={w.variantId}>{w.name} (con {w.available})</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Payment */}
          <section className="card checkout-block">
            <h3>Phuong thuc thanh toan</h3>
            <div className="stack gap-sm" style={{ marginTop: 12 }}>
              <label className={`ship-option ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                <input type="radio" name="pay" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
                <div><strong>Thanh toan khi nhan hang (COD)</strong></div>
              </label>
              <label className={`ship-option ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}>
                <input type="radio" name="pay" checked={paymentMethod === 'VNPAY'} onChange={() => setPaymentMethod('VNPAY')} />
                <div><strong>VNPay (the/QR)</strong> <span className="muted">· Sandbox</span></div>
              </label>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Ghi chu don hang</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Giao buoi sang" />
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="card checkout-summary">
          <h3>Don hang ({items.length})</h3>
          {storeName && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>🏪 {storeName}</div>}
          <div className="stack gap-sm checkout-items">
            {items.map((it) => (
              <div key={it.id} className="between checkout-line">
                <span>{it.name} <span className="muted">×{it.quantity}</span></span>
                <span>{formatVnd(it.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="coupon-row">
            <input className="input" placeholder="Ma giam gia" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
          </div>
          <div className="summary-divider" />
          <div className="summary-row"><span className="muted">Tam tinh</span><span>{formatVnd(quote?.subtotal ?? subtotal)}</span></div>
          <div className="summary-row">
            <span className="muted">Phi giao hang</span>
            <span>{quote ? (quote.shippingFee === 0 ? 'Mien phi' : formatVnd(quote.shippingFee)) : '—'}</span>
          </div>
          {quote && quote.discountTotal > 0 && (
            <div className="summary-row" style={{ color: 'var(--green-600)' }}>
              <span>Giam gia {quote.coupon}</span><span>−{formatVnd(quote.discountTotal)}</span>
            </div>
          )}
          <div className="summary-divider" />
          <div className="summary-row summary-total"><strong>Tong cong</strong><strong className="price">{formatVnd(quote?.grandTotal ?? subtotal)}</strong></div>
          {hasIssues && <p className="addr-warn" style={{ marginTop: 8 }}>Mot so san pham trong gio dang het hang.</p>}
          <button
            className="btn btn-primary btn-block"
            onClick={placeOrder}
            disabled={placing || !addressId || notServiceable}
          >
            {placing ? 'Dang xu ly...' : paymentMethod === 'VNPAY' ? 'Thanh toan VNPay' : 'Dat hang (COD)'}
          </button>
        </aside>
      </div>
    </div>
  );
}

function extractParts(formatted: string): { province: string; district: string; ward: string } {
  const stripDiacritics = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parts = formatted.split(',').map((s) => s.trim());
  const filtered = parts.filter((p) => {
    if (!p) return false;
    const ascii = stripDiacritics(p).toLowerCase();
    if (/^viet\s?nam$/.test(ascii)) return false;
    if (/^vn$/.test(ascii)) return false;
    if (/^\d{4,7}$/.test(p)) return false;
    return true;
  });
  const n = filtered.length;
  return {
    province: filtered[n - 1] ?? '',
    district: filtered[n - 2] ?? '',
    ward: filtered[n - 3] ?? '',
  };
}
