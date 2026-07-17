import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { BarcodeManagerModal } from './BarcodeManagerModal';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  originRegion: string | null;
  category: { name: string } | null;
  imageUrl: string | null;
  image?: string | null;
  fromPrice: number | null;
  unit: string | null;
}
interface Category { id: string; name: string; slug: string; }

export default function AdminProductsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [barcodeProductId, setBarcodeProductId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => api.get('/admin/products', { params: { limit: 100 } }).then((r) => r.data.data as ProductRow[]),
  });

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        subtitle="Danh mục sản phẩm chung của chuỗi"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Thêm sản phẩm</button>}
      />
      <DataTable<ProductRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText="Chưa có sản phẩm nào"
        columns={[
          {
            key: 'name',
            title: 'Tên',
            render: (r) => {
              const imageUrl = r.imageUrl ?? r.image;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 240 }}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={r.name}
                      loading="lazy"
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        background: '#f8fafc',
                        flex: '0 0 auto',
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        border: '1px dashed #cbd5e1',
                        background: '#f8fafc',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        flex: '0 0 auto',
                      }}
                    >
                      NS
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block' }}>{r.name}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{r.slug}</span>
                  </div>
                </div>
              );
            },
          },
          { key: 'cat', title: 'Danh mục', render: (r) => r.category?.name ?? '—' },
          { key: 'origin', title: 'Xuất xứ', render: (r) => r.originRegion ?? '—' },
          { key: 'price', title: 'Giá từ', align: 'right', render: (r) => r.fromPrice ? `${formatVnd(r.fromPrice)}/${r.unit}` : '—' },
          { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: '', align: 'right', render: (r) => (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setBarcodeProductId(r.id)}
                title="Quản lý mã vạch POS"
              >
                Mã vạch
              </button>
            ),
          },
        ]}
      />
      {creating && (
        <CreateProductModal
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['admin-products'] }); }}
        />
      )}
      {barcodeProductId && (
        <BarcodeManagerModal
          productId={barcodeProductId}
          onClose={() => setBarcodeProductId(null)}
        />
      )}
    </>
  );
}

function CreateProductModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { push } = useToastStore();
  const [form, setForm] = useState({ name: '', slug: '', categoryId: '', originRegion: '', imageUrl: '', sku: '', unit: 'kg', price: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data as Category[]),
  });

  const mut = useMutation({
    mutationFn: async () => {
      let imageUrl = form.imageUrl || undefined;
      if (imageFile) {
        const payload = new FormData();
        payload.append('file', imageFile);
        const uploaded = await api.post('/admin/media/products', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrl = uploaded.data.data.url as string;
      }
      return api.post('/admin/products', {
        name: form.name,
        slug: form.slug || form.name.toLowerCase().trim().replace(/\s+/g, '-'),
        categoryId: form.categoryId,
        originRegion: form.originRegion || undefined,
        imageUrl,
        variant: {
          sku: form.sku || (form.slug || form.name).toUpperCase(),
          unit: form.unit,
          price: Number(form.price),
        },
      });
    },
    onSuccess: () => { push('Đã tạo sản phẩm'); onDone(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Thêm sản phẩm</h2>
        <div className="dash-form-grid">
          <label>Tên<input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Slug<input className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} /></label>
          <label>Danh mục
            <select className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">-- Chọn --</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Xuất xứ<input className="input" value={form.originRegion} onChange={(e) => set('originRegion', e.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}>
            Ảnh sản phẩm
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setImageFile(file);
                setImagePreview(file ? URL.createObjectURL(file) : '');
              }}
            />
            <span className="muted" style={{ display: 'block', marginTop: 5, fontSize: 12 }}>
              JPG, PNG, WebP hoặc GIF, tối đa 5 MB.
            </span>
          </label>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Xem trước ảnh sản phẩm"
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
            />
          )}
          <label>SKU<input className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} /></label>
          <label>Đơn vị<input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></label>
          <label>Giá (VNĐ)<input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
        </div>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!form.name || !form.categoryId || !form.price || !imageFile || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? 'Đang tải ảnh...' : 'Tạo'}</button>
        </div>
      </div>
    </div>
  );
}
