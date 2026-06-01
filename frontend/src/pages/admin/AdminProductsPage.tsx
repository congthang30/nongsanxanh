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
  id: string; name: string; slug: string; status: string;
  originRegion: string | null; category: { name: string } | null;
  fromPrice: number | null; unit: string | null;
}
interface Category { id: string; name: string; slug: string; }

export default function AdminProductsPage() {
  const qc = useQueryClient();
  const { push } = useToastStore();
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
          { key: 'name', title: 'Tên', render: (r) => <strong>{r.name}</strong> },
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
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data as Category[]),
  });

  const mut = useMutation({
    mutationFn: () => api.post('/admin/products', {
      name: form.name, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      categoryId: form.categoryId, originRegion: form.originRegion || undefined,
      imageUrl: form.imageUrl || undefined,
      variant: { sku: form.sku || `${form.slug || form.name}`.toUpperCase(), unit: form.unit, price: Number(form.price) },
    }),
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
          <label>Ảnh URL<input className="input" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} /></label>
          <label>SKU<input className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} /></label>
          <label>Đơn vị<input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></label>
          <label>Giá (VNĐ)<input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
        </div>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!form.name || !form.categoryId || !form.price || mut.isPending} onClick={() => mut.mutate()}>Tạo</button>
        </div>
      </div>
    </div>
  );
}
