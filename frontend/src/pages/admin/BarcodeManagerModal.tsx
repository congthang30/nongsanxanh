import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';

interface Variant {
  id: string;
  sku: string;
  unit: string;
  status: string;
}

interface ProductDetail {
  id: string;
  name: string;
  variants: Variant[];
}

interface Barcode {
  id: string;
  barcode: string;
  type: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'QR' | 'INTERNAL';
  isPrimary: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  variantId: string;
  sku: string;
  productName: string;
}

const TYPES: Barcode['type'][] = ['EAN13', 'EAN8', 'UPC', 'CODE128', 'CODE39', 'QR', 'INTERNAL'];

/**
 * Modal quan ly ma vach (barcode) cho mot san pham. Hien danh sach barcode hien co
 * theo tung variant + form them moi. Backend endpoints:
 * - GET    /admin/barcodes?variantId=
 * - POST   /admin/products/:variantId/barcodes
 * - PATCH  /admin/barcodes/:id
 * - DELETE /admin/barcodes/:id
 */
export function BarcodeManagerModal({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [activeVariantId, setActiveVariantId] = useState<string>('');
  const [form, setForm] = useState({ barcode: '', type: 'EAN13' as Barcode['type'], isPrimary: false });

  const { data: product } = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => api.get(`/admin/products/${productId}`).then((r) => r.data.data as ProductDetail),
  });

  // Default variant active (first one)
  const variants = product?.variants ?? [];
  const variantId = activeVariantId || variants[0]?.id || '';

  const { data: barcodes = [], refetch } = useQuery({
    queryKey: ['admin-barcodes', variantId],
    enabled: !!variantId,
    queryFn: () => api.get('/admin/barcodes', { params: { variantId } }).then((r) => r.data.data as Barcode[]),
  });

  const createMut = useMutation({
    mutationFn: () => api.post(`/admin/products/${variantId}/barcodes`, form),
    onSuccess: () => {
      push('Đã gán mã vạch');
      setForm({ barcode: '', type: 'EAN13', isPrimary: false });
      refetch();
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Barcode> }) =>
      api.patch(`/admin/barcodes/${id}`, patch),
    onSuccess: () => { refetch(); push('Đã cập nhật'); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/barcodes/${id}`),
    onSuccess: () => { refetch(); push('Đã xóa mã vạch'); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const submitDisabled = !variantId || !form.barcode.trim() || form.barcode.trim().length < 4 || createMut.isPending;

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <h2>Quản lý mã vạch</h2>
        <p className="muted" style={{ marginTop: -4, marginBottom: 14 }}>{product?.name ?? '...'}</p>

        {variants.length > 1 && (
          <div className="flex gap-sm" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            {variants.map((v) => (
              <button
                key={v.id}
                className={`btn btn-sm ${variantId === v.id ? 'btn-dark' : 'btn-ghost'}`}
                onClick={() => setActiveVariantId(v.id)}
              >
                {v.sku} ({v.unit})
              </button>
            ))}
          </div>
        )}

        {/* Existing barcodes */}
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ margin: '0 0 8px' }}>Mã vạch hiện có</h4>
          {barcodes.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, padding: '12px 0' }}>
              Variant này chưa có mã vạch. POS sẽ không quét được cho tới khi gán mã.
            </p>
          ) : (
            <div className="stack gap-sm">
              {barcodes.map((b) => (
                <div
                  key={b.id}
                  className="between"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: b.status === 'ACTIVE' ? '#f8fafc' : '#fef2f2',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div>
                    <strong style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}>
                      {b.barcode}
                    </strong>
                    <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                      {b.type}{b.isPrimary && ' · CHÍNH'}{b.status === 'INACTIVE' && ' · NGỪNG'}
                    </span>
                  </div>
                  <div className="flex gap-sm">
                    {!b.isPrimary && b.status === 'ACTIVE' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => updateMut.mutate({ id: b.id, patch: { isPrimary: true } })}
                        disabled={updateMut.isPending}
                      >
                        Đặt chính
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => updateMut.mutate({
                        id: b.id,
                        patch: { status: b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
                      })}
                      disabled={updateMut.isPending}
                    >
                      {b.status === 'ACTIVE' ? 'Ngừng' : 'Kích hoạt'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#dc2626' }}
                      onClick={() => {
                        if (confirm(`Xóa mã vạch ${b.barcode}?`)) deleteMut.mutate(b.id);
                      }}
                      disabled={deleteMut.isPending}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
          <h4 style={{ margin: '0 0 8px' }}>Thêm mã vạch mới</h4>
          <div className="dash-form-grid">
            <label>
              Mã vạch
              <input
                className="input"
                placeholder="VD: 8930000099999"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value.trim() }))}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
            </label>
            <label>
              Loại
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Barcode['type'] }))}
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex gap-sm" style={{ alignItems: 'center', gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              />
              <span>Đặt làm mã chính (in trên bao bì, tự động quét).</span>
            </label>
          </div>
          <div className="flex gap-sm" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
            <button
              className="btn btn-primary"
              disabled={submitDisabled}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
