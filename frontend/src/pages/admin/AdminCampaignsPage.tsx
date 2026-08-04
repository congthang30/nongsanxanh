import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CircleDollarSign, Plus, Tag, TimerReset } from 'lucide-react';
import { DataTable } from '../../dashboard/components/DataTable';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { api, getErrorMessage } from '../../lib/api';
import { formatVnd } from '../../lib/format';
import { useToastStore } from '../../lib/toast.store';
import './admin-campaigns.css';

interface ProductRow {
  id: string;
  name: string;
  imageUrl?: string | null;
  image?: string | null;
  fromPrice: number | null;
  unit: string | null;
}

interface Variant {
  id: string;
  sku: string;
  unit: string;
  price: number;
  status: string;
}

interface ProductDetail {
  id: string;
  name: string;
  variants: Variant[];
}

interface SelectableBatch {
  id: string;
  batchCode: string;
  variantId: string;
  expiryDate: string;
  available: number;
  store: { id: string; name: string; code: string };
}

interface CampaignItem {
  id: string;
  salePrice: number;
  batch: (SelectableBatch & { store: { id: string; name: string } }) | null;
  variant: Variant & { product: { id: string; name: string } };
}

interface Campaign {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  effectiveStatus: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  items: CampaignItem[];
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function vietnamNowInput(minutes = 0) {
  const now = new Date(Date.now() + minutes * 60_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function vietnamInputToIso(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}

function formatVietnamTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AdminCampaignsPage() {
  const queryClient = useQueryClient();
  const { push } = useToastStore();
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [form, setForm] = useState({
    name: '',
    salePrice: '',
    startsAt: vietnamNowInput(10),
    endsAt: vietnamNowInput(24 * 60),
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => api.get('/admin/campaigns').then((response) => response.data.data as Campaign[]),
    refetchInterval: 30_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products-campaign-selector'],
    queryFn: () =>
      api
        .get('/admin/products', { params: { limit: 100 } })
        .then((response) => response.data.data as ProductRow[]),
  });

  const { data: product } = useQuery({
    queryKey: ['admin-product-campaign', productId],
    enabled: !!productId,
    queryFn: () =>
      api
        .get(`/admin/products/${productId}`)
        .then((response) => response.data.data as ProductDetail),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-campaign-batches', variantId],
    enabled: !!variantId,
    queryFn: () =>
      api
        .get('/admin/campaigns/batches', { params: { variantId } })
        .then((response) => response.data.data as SelectableBatch[]),
  });

  const variants = product?.variants.filter((variant) => variant.status === 'ACTIVE') ?? [];
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const discountPercent = useMemo(() => {
    const salePrice = Number(form.salePrice);
    if (!selectedVariant || salePrice <= 0 || salePrice >= selectedVariant.price) return null;
    return Math.round((1 - salePrice / selectedVariant.price) * 100);
  }, [form.salePrice, selectedVariant]);

  const createMutation = useMutation({
    mutationFn: () => {
      const slug = `${product?.name ?? 'gia'}-${Date.now()}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return api.post('/admin/campaigns', {
        name: form.name.trim(),
        slug,
        startsAt: vietnamInputToIso(form.startsAt),
        endsAt: vietnamInputToIso(form.endsAt),
        items: [{
          variantId,
          ...(batchId ? { batchId } : {}),
          salePrice: Number(form.salePrice),
        }],
      });
    },
    onSuccess: () => {
      push('Đã lên lịch giá. Hệ thống sẽ tự áp dụng đúng giờ.');
      setForm({
        name: '',
        salePrice: '',
        startsAt: vietnamNowInput(10),
        endsAt: vietnamNowInput(24 * 60),
      });
      setProductId('');
      setVariantId('');
      setBatchId('');
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/campaigns/${id}/cancel`),
    onSuccess: () => {
      push('Đã hủy chương trình giá');
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
  });

  const invalidTime =
    !form.startsAt ||
    !form.endsAt ||
    vietnamInputToIso(form.startsAt) <= new Date().toISOString() ||
    vietnamInputToIso(form.startsAt) >= vietnamInputToIso(form.endsAt);
  const canCreate =
    !!form.name.trim() &&
    !!variantId &&
    Number(form.salePrice) > 0 &&
    !!selectedVariant &&
    Number(form.salePrice) < selectedVariant.price &&
    !invalidTime &&
    !createMutation.isPending;

  return (
    <>
      <PageHeader
        title="Quản lý giá"
        subtitle="Hẹn giá bán tự động theo giờ Việt Nam, không cần chạy cron thủ công"
      />

      <section className="campaign-hero" aria-labelledby="campaign-create-title">
        <div className="campaign-hero-copy">
          <span className="campaign-eyebrow"><CalendarClock size={16} /> Tự động theo lịch</span>
          <h2 id="campaign-create-title">Lên lịch giá mới</h2>
          <p>
            Giá được áp dụng đồng nhất tại cửa hàng online, giỏ hàng, checkout và POS.
            Hết giờ, hệ thống tự trở về giá thường.
          </p>
        </div>
        <div className="campaign-form-card">
          <div className="campaign-form-grid">
            <label>
              Tên chương trình
              <input
                id="campaign-name"
                className="input"
                placeholder="Ví dụ: Giá cà chua ngày 12/02"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Sản phẩm
              <select
                id="campaign-product"
                className="input"
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setVariantId('');
                  setBatchId('');
                  setForm((current) => ({ ...current, salePrice: '' }));
                }}
              >
                <option value="">-- Chọn sản phẩm --</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Phiên bản
              <select
                id="campaign-variant"
                className="input"
                value={variantId}
                disabled={!productId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setBatchId('');
                  setForm((current) => ({ ...current, salePrice: '' }));
                }}
              >
                <option value="">-- Chọn phiên bản --</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku} · {variant.unit} · {formatVnd(variant.price)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phạm vi lô hàng
              <select
                id="campaign-batch"
                className="input"
                value={batchId}
                disabled={!variantId}
                onChange={(event) => setBatchId(event.target.value)}
              >
                <option value="">Toàn bộ lô của phiên bản</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode} · {batch.store.name} · HSD{' '}
                    {new Date(batch.expiryDate).toLocaleDateString('vi-VN')} · còn {batch.available}
                  </option>
                ))}
              </select>
              <span className="campaign-hint">
                Chọn một lô để giảm riêng hàng gần hết hạn; để trống sẽ giảm toàn phiên bản.
              </span>
            </label>
            <label>
              Giá trong chương trình
              <div className="campaign-price-input">
                <CircleDollarSign size={18} aria-hidden />
                <input
                  id="campaign-sale-price"
                  className="input"
                  type="number"
                  min="1"
                  step="1000"
                  placeholder="120000"
                  value={form.salePrice}
                  onChange={(event) => setForm((current) => ({ ...current, salePrice: event.target.value }))}
                />
              </div>
              {selectedVariant && (
                <span className="campaign-hint">
                  Giá thường {formatVnd(selectedVariant.price)}
                  {discountPercent != null && ` · giảm ${discountPercent}%`}
                </span>
              )}
            </label>
            <label>
              Bắt đầu (giờ Việt Nam)
              <input
                id="campaign-start-time"
                className="input"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </label>
            <label>
              Kết thúc (giờ Việt Nam)
              <input
                id="campaign-end-time"
                className="input"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </label>
          </div>

          <div className="campaign-form-footer">
            <div className="campaign-rule"><TimerReset size={16} /> Giá kết thúc đúng tại mốc “Kết thúc”.</div>
            <button
              id="campaign-create-button"
              type="button"
              className="btn btn-primary"
              disabled={!canCreate}
              onClick={() => createMutation.mutate()}
            >
              <Plus size={17} /> {createMutation.isPending ? 'Đang lưu...' : 'Lên lịch giá'}
            </button>
          </div>
        </div>
      </section>

      <section className="campaign-list-section" aria-labelledby="campaign-list-title">
        <div className="campaign-section-heading">
          <div>
            <span className="campaign-eyebrow"><Tag size={16} /> Lịch giá</span>
            <h2 id="campaign-list-title">Các chương trình đã tạo</h2>
          </div>
          <span className="campaign-timezone">Múi giờ: Asia/Ho_Chi_Minh (UTC+7)</span>
        </div>
        <DataTable<Campaign>
          rows={campaigns}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyText="Chưa có chương trình giá nào"
          columns={[
            {
              key: 'name',
              title: 'Chương trình',
              render: (row) => (
                <div className="campaign-name-cell">
                  <strong>{row.name}</strong>
                  <span>{row.items.length} sản phẩm/phiên bản</span>
                </div>
              ),
            },
            {
              key: 'product',
              title: 'Sản phẩm và giá',
              render: (row) => (
                <div className="campaign-products-cell">
                  {row.items.map((item) => (
                    <span key={item.id}>
                      {item.variant.product.name} · {item.variant.sku}
                      {item.batch && ` · lô ${item.batch.batchCode} (${item.batch.store.name})`}:{' '}
                      <strong>{formatVnd(item.salePrice)}</strong>
                      <small>{formatVnd(item.variant.price)}</small>
                    </span>
                  ))}
                </div>
              ),
            },
            {
              key: 'time',
              title: 'Thời gian',
              render: (row) => (
                <div className="campaign-time-cell">
                  <span>{formatVietnamTime(row.startsAt)}</span>
                  <i aria-hidden>→</i>
                  <span>{formatVietnamTime(row.endsAt)}</span>
                </div>
              ),
            },
            {
              key: 'status',
              title: 'Trạng thái',
              render: (row) => <StatusBadge status={row.effectiveStatus} />,
            },
            {
              key: 'actions',
              title: '',
              align: 'right',
              render: (row) =>
                row.effectiveStatus === 'SCHEDULED' || row.effectiveStatus === 'ACTIVE' ? (
                  <button
                    id={`campaign-cancel-${row.id}`}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      if (confirm(`Hủy chương trình “${row.name}”? Giá thường sẽ được dùng ngay.`)) {
                        cancelMutation.mutate(row.id);
                      }
                    }}
                  >
                    Hủy
                  </button>
                ) : null,
            },
          ]}
        />
      </section>
    </>
  );
}
