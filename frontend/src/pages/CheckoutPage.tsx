import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { useCartStore } from '../lib/cart.store';
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
  couponError?: string | null;
  grandTotal: number;
}
interface Prediction { placeId: string; description: string; }

export default function CheckoutPage() {
  const { items, subtotal, hasIssues, fetch } = useCartStore();
  const { push } = useToastStore();
  const navigate = useNavigate();

  const [addressId, setAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'VNPAY'>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
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

  // Quote: backend tự resolve cửa hàng phù hợp theo địa chỉ + tồn kho.
  // Frontend chỉ hiển thị kết quả, không gửi storeId/giá.
  useEffect(() => {
    if (items.length === 0 || !addressId) { setQuote(null); return; }
    setQuoting(true);
    api
      .post('/cart/checkout/quote', { addressId, paymentMethod, couponCode: appliedCoupon || undefined })
      .then((r) => setQuote(r.data.data as Quote))
      .catch(() => setQuote(null))
      .finally(() => setQuoting(false));
  }, [items.length, addressId, appliedCoupon, paymentMethod]);

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
      if (!geo) { push('Không lấy được tọa độ địa chỉ này', 'error'); return; }
      setPicked({ placeId: geo.placeId, formattedAddress: geo.formattedAddress, lat: geo.lat, lng: geo.lng });
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setResolving(false);
    }
  };

  const saveAddress = async () => {
    if (!recipientName || !phone) { push('Nhập tên người nhận và số điện thoại', 'error'); return; }
    if (!picked) { push('Hãy chọn địa chỉ từ gợi ý bản đồ', 'error'); return; }
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
      push('Đã thêm địa chỉ giao hàng');
      setShowAddrForm(false);
      setRecipientName(''); setPhone(''); setSearch(''); setPicked(null); setAddressDetail('');
      refetchAddr();
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  const applyCoupon = () => {
    setAppliedCoupon(couponCode.trim().toUpperCase());
  };

  const placeOrder = async () => {
    if (!addressId) { push('Vui lòng chọn địa chỉ giao hàng', 'error'); return; }
    if (quote && !quote.serviceable) {
      push('Khu vực này chưa có cửa hàng phục vụ đầy đủ', 'error');
      return;
    }
    setPlacing(true);
    try {
      // Chỉ gửi các trường hợp lệ; backend tự resolve cửa hàng/giá/phí/tổng.
      const { data } = await api.post('/orders', {
        addressId, paymentMethod,
        couponCode: appliedCoupon || undefined, note: note || undefined,
      });
      const order = data.data;
      if (paymentMethod === 'VNPAY') {
        const pay = await api.post('/payments', { orderId: order.id });
        window.location.href = pay.data.data.paymentUrl;
        return;
      }
      push('Đặt hàng thành công!');
      await fetch().catch(() => {});
      navigate(`/orders/${order.id}`);
    } catch (e) {
      push(getErrorMessage(e), 'error');
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container section">
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">Giỏ hàng trống. Hãy thêm sản phẩm trước khi đặt hàng.</p>
        </div>
      </div>
    );
  }

  const notServiceable = quote != null && !quote.serviceable;
  const couponInvalid = !!(appliedCoupon && quote && quote.coupon == null);

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 24 }}>Thanh toán</h1>

      <div className="checkout-layout">
        <div className="stack gap-lg">
          {/* Address */}
          <section className="card checkout-block">
            <div className="between">
              <h3>Địa chỉ giao hàng</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddrForm((s) => !s)}>
                {showAddrForm ? 'Đóng' : '+ Thêm địa chỉ'}
              </button>
            </div>
            {showAddrForm && (
              <div className="addr-form">
                <div className="addr-grid">
                  <input className="input" placeholder="Người nhận" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} aria-label="Người nhận" />
                  <input className="input" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Số điện thoại" />
                </div>
                <label className="addr-label">Tìm địa chỉ giao hàng</label>
                <div className="addr-autocomplete">
                  <input
                    className="input"
                    placeholder="Gõ tên đường rồi chọn từ gợi ý (vd: Lê Duẩn, Quận 1)..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
                    autoComplete="off"
                    aria-label="Tìm địa chỉ giao hàng"
                  />
                  {search.trim().length >= 2 && !picked && (
                    <div className="addr-predictions">
                      {searching && <div className="addr-pred-hint">Đang tìm địa chỉ...</div>}
                      {!searching && predictions.map((p) => (
                        <button key={p.placeId} className="addr-pred" onClick={() => pickPrediction(p)}>
                          {p.description}
                        </button>
                      ))}
                      {!searching && predictions.length === 0 && (
                        <div className="addr-pred-hint">Không tìm thấy. Thử nhập chi tiết hơn.</div>
                      )}
                    </div>
                  )}
                </div>
                {resolving && <p className="muted">Đang lấy tọa độ...</p>}
                {picked && (
                  <>
                    <div className="addr-verified">
                      Địa chỉ: {picked.formattedAddress}
                      <span className="muted"> ({picked.lat.toFixed(4)}, {picked.lng.toFixed(4)})</span>
                    </div>
                    <label className="addr-label">Số nhà, hẻm, tầng, ghi chú địa chỉ</label>
                    <input
                      className="input"
                      placeholder="vd: 8/10/5 đường số 21, tầng 2..."
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      aria-label="Số nhà, hẻm, tầng, ghi chú địa chỉ"
                    />
                  </>
                )}
                <button className="btn btn-dark btn-sm" onClick={saveAddress} disabled={!picked} style={{ marginTop: 12 }}>Lưu địa chỉ</button>
              </div>
            )}
            <div className="stack gap-sm" style={{ marginTop: 12 }}>
              {addresses?.map((a) => (
                <label key={a.id} className={`addr-option ${addressId === a.id ? 'selected' : ''}`}>
                  <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <div>
                    <strong>{a.recipientName}</strong> · {a.phone}
                    <div className="muted">{a.formattedAddress ?? `${a.line1}, ${a.ward}, ${a.district}, ${a.province}`}</div>
                    {a.lat == null && <div className="addr-warn">Chưa có tọa độ xác thực</div>}
                  </div>
                </label>
              ))}
              {addresses?.length === 0 && !showAddrForm && (
                <p className="muted">Chưa có địa chỉ. Hãy thêm địa chỉ giao hàng.</p>
              )}
            </div>
          </section>

          {/* Kiểm tra khả năng phục vụ */}
          {quote && quote.serviceable && quote.store && (
            <section className="card checkout-block">
              <div className="note-banner note-banner-success">
                <span>
                  Cửa hàng hệ thống chọn: <strong>{quote.store.name}</strong>
                  {quote.store.distanceKm != null && (
                    <span className="muted"> · cách {quote.store.distanceKm.toFixed(1)} km</span>
                  )}
                  {quote.etaText && <span className="muted"> · {quote.etaText}</span>}
                </span>
              </div>
            </section>
          )}

          {/* Lỗi thiếu hàng / không phục vụ */}
          {(quote?.reason === 'NO_ACTIVE_STORE' || notServiceable || (quote?.inventoryWarnings && quote.inventoryWarnings.length > 0)) && (
            <section className="card checkout-block">
              {quote?.reason === 'NO_ACTIVE_STORE' && (
                <div className="note-banner note-banner-error">
                  Hiện chưa có cửa hàng nào đang hoạt động phục vụ địa chỉ này. Vui lòng đổi địa chỉ hoặc quay lại sau.
                </div>
              )}
              {notServiceable && quote?.reason !== 'NO_ACTIVE_STORE' && (
                <div className="note-banner note-banner-error">
                  Khu vực này chưa phục vụ đầy đủ. Bạn có thể: đổi địa chỉ giao hàng, giảm số lượng, hoặc bỏ sản phẩm không có sẵn.
                </div>
              )}
              {quote?.inventoryWarnings && quote.inventoryWarnings.length > 0 && (
                <div className="note-banner note-banner-warn" style={{ marginTop: 10 }}>
                  <div>
                    Một số sản phẩm không đủ tồn kho để giao đến địa chỉ này:
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {quote.inventoryWarnings.map((w) => (
                        <li key={w.variantId}>{w.name} (còn {w.available})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Hint giá cập nhật theo cửa hàng phục vụ */}
          {quote && quote.serviceable && quote.subtotal !== subtotal && quote.store && (
            <section className="card checkout-block">
              <div className="note-banner note-banner-info">
                Giá và phí giao hàng đã được cập nhật theo cửa hàng phù hợp với địa chỉ này. Tạm tính mới: <strong>{formatVnd(quote.subtotal)}</strong>.
              </div>
            </section>
          )}

          {/* Payment */}
          <section className="card checkout-block">
            <h3>Phương thức thanh toán</h3>
            <div className="stack gap-sm" style={{ marginTop: 12 }}>
              <label className={`ship-option ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                <input type="radio" name="pay" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
                <div><strong>Thanh toán khi nhận hàng (COD)</strong></div>
              </label>
              <label className={`ship-option ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}>
                <input type="radio" name="pay" checked={paymentMethod === 'VNPAY'} onChange={() => setPaymentMethod('VNPAY')} />
                <div><strong>VNPay (thẻ/QR)</strong> <span className="muted">· Sandbox</span></div>
              </label>
            </div>
            {paymentMethod === 'VNPAY' && (
              <p className="note-banner note-banner-info" style={{ marginTop: 12 }}>
                Bạn sẽ được chuyển sang VNPay. Đơn chỉ được xác nhận sau khi thanh toán thành công.
              </p>
            )}
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="order-note">Ghi chú đơn hàng</label>
              <input id="order-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Giao buổi sáng" />
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="card checkout-summary">
          <h3>Đơn hàng ({items.length})</h3>
          <div className="stack gap-sm checkout-items">
            {items.map((it) => (
              <div key={it.id} className="between checkout-line">
                <span>{it.name} <span className="muted">×{it.quantity}</span></span>
                <span>{formatVnd(it.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="coupon-row">
            <input
              className="input"
              placeholder="Mã giảm giá"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              aria-label="Mã giảm giá"
            />
            <button className="btn btn-ghost btn-sm" onClick={applyCoupon} disabled={!couponCode.trim()}>Áp dụng</button>
          </div>
          {couponInvalid && (
            <p className="addr-warn" style={{ marginTop: 6 }}>
              Mã giảm giá không hợp lệ hoặc đã hết lượt. Vui lòng kiểm tra lại.
            </p>
          )}
          <div className="summary-divider" />
          <div className="summary-row"><span className="muted">Tạm tính</span><span>{formatVnd(quote?.subtotal ?? subtotal)}</span></div>
          <div className="summary-row">
            <span className="muted">Phí giao hàng</span>
            <span>
              {quoting
                ? 'Đang tính...'
                : quote && typeof quote.shippingFee === 'number'
                ? quote.shippingFee === 0
                  ? 'Miễn phí'
                  : formatVnd(quote.shippingFee)
                : 'Chọn địa chỉ để tính'}
            </span>
          </div>
          {quote && quote.discountTotal > 0 && (
            <div className="summary-row" style={{ color: 'var(--green-600)' }}>
              <span>Giảm giá {quote.coupon}</span><span>−{formatVnd(quote.discountTotal)}</span>
            </div>
          )}
          <div className="summary-divider" />
          <div className="summary-row summary-total"><strong>Tổng cộng</strong><strong className="price">{formatVnd(quote?.grandTotal ?? subtotal)}</strong></div>
          {hasIssues && <p className="addr-warn" style={{ marginTop: 8 }}>Một số sản phẩm trong giỏ đang hết hàng.</p>}
          <button
            className="btn btn-primary btn-block"
            onClick={placeOrder}
            disabled={placing || quoting || !addressId || notServiceable}
          >
            {placing
              ? 'Đang tạo đơn...'
              : paymentMethod === 'VNPAY'
              ? 'Thanh toán qua VNPay'
              : 'Đặt hàng COD'}
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
