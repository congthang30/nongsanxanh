import { formatVnd } from '../../lib/format';
import { ReceiptData, PAYMENT_LABELS, POSPaymentMethod } from '../pos.api';

/** Hoa don in duoc (browser print). Du thong tin theo spec muc 13. */
export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const dt = receipt.paidAt ?? receipt.createdAt;
  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="pos-receipt" id="pos-receipt">
          <h2>{receipt.store.name}</h2>
          {receipt.store.address && <p className="r-center">{receipt.store.address}</p>}
          {receipt.store.phone && <p className="r-center">ĐT: {receipt.store.phone}</p>}
          <hr />
          <div className="r-row">
            <span>Hóa đơn</span>
            <b>{receipt.saleNumber}</b>
          </div>
          <div className="r-row">
            <span>Ngày</span>
            <span>{new Date(dt).toLocaleString('vi-VN')}</span>
          </div>
          <div className="r-row">
            <span>Thu ngân</span>
            <span>{receipt.cashier.name}</span>
          </div>
          {receipt.customerPhone && (
            <div className="r-row">
              <span>Khách</span>
              <span>{receipt.customerPhone}</span>
            </div>
          )}
          <hr />
          {receipt.items.map((it, i) => (
            <div className="r-item" key={i}>
              <div className="r-item-name">{it.name}</div>
              <div className="r-row r-muted">
                <span>
                  {it.quantity} {it.unit} x {formatVnd(it.unitPrice)}
                </span>
                <span className="pos-tabular">{formatVnd(it.lineTotal)}</span>
              </div>
            </div>
          ))}
          <hr />
          <div className="r-row">
            <span>Tạm tính</span>
            <span className="pos-tabular">{formatVnd(receipt.subtotal)}</span>
          </div>
          {receipt.discountTotal > 0 && (
            <div className="r-row">
              <span>Giảm giá</span>
              <span className="pos-tabular">-{formatVnd(receipt.discountTotal)}</span>
            </div>
          )}
          <div className="r-row r-grand">
            <span>TỔNG CỘNG</span>
            <span className="pos-tabular">{formatVnd(receipt.grandTotal)}</span>
          </div>
          <hr />
          {receipt.payments.map((p, i) => (
            <div className="r-row" key={i}>
              <span>{PAYMENT_LABELS[p.method as POSPaymentMethod] ?? p.method}</span>
              <span className="pos-tabular">{formatVnd(p.amount)}</span>
            </div>
          ))}
          {receipt.changeAmount > 0 && (
            <div className="r-row">
              <span>Tiền thối</span>
              <span className="pos-tabular">{formatVnd(receipt.changeAmount)}</span>
            </div>
          )}
          <hr />
          <p className="r-center">Cảm ơn quý khách!</p>
          <p className="r-center">Hotline: {receipt.hotline}</p>
        </div>
        <div className="pos-btn-row pos-no-print" style={{ marginTop: 12 }}>
          <button className="pos-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="pos-btn pos-btn-primary" onClick={() => window.print()}>
            In hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
}
