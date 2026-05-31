import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatVnd } from '../lib/format';
import { useCartStore } from '../lib/cart.store';
import { useStoreContext } from '../lib/store.store';
import { useToastStore } from '../lib/toast.store';
import { getErrorMessage } from '../lib/api';
import { StorePicker } from '../components/StorePicker';
import './product-detail.css';

interface Variant {
  id: string; sku: string; unit: string; price: number;
  compareAtPrice: number | null; available: number;
}
interface ProductDetail {
  id: string; name: string; description: string | null; originRegion: string | null;
  storageInstruction?: string | null; shelfLifeDays?: number | null;
  ratingAvg: number; ratingCount: number;
  category: { name: string };
  images: { url: string; isPrimary: boolean }[];
  attributes: { key: string; value: string }[];
  variants: Variant[];
  store?: { id: string; name: string };
}
interface Review {
  id: string; rating: number; comment: string | null; createdAt: string;
  user: { profile: { fullName: string } | null };
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { add } = useCartStore();
  const { store } = useStoreContext();
  const { push } = useToastStore();
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);

  // Neu da chon store -> lay chi tiet theo store (gia + ton thuc te). Neu chua -> catalog global.
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug, store?.id],
    queryFn: () => {
      const url = store
        ? `/stores/${store.id}/products/${slug}`
        : `/products/${slug}`;
      return api.get(url).then((r) => r.data.data as ProductDetail);
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', product?.id],
    enabled: !!product?.id,
    queryFn: () => api.get(`/products/${product!.id}/reviews`).then((r) => r.data.data as Review[]),
  });

  const { data: related } = useQuery({
    queryKey: ['related', slug],
    enabled: !!slug,
    queryFn: () =>
      api.get(`/products/${slug}/related`).then(
        (r) => r.data.data as { id: string; name: string; slug: string; image: string | null; fromPrice: number | null; unit: string | null; ratingAvg: number }[],
      ),
  });

  if (isLoading || !product) {
    return <div className="container section"><div className="skeleton" style={{ height: 420 }} /></div>;
  }

  const variant = product.variants.find((v) => v.id === selectedVariant) ?? product.variants[0];
  const hasStore = !!store;
  const available = hasStore ? (variant?.available ?? 0) : 1;

  const handleAdd = async () => {
    if (!variant) return;
    if (!store) { push('Vui long chon khu vuc giao hang truoc', 'error'); return; }
    setAdding(true);
    try {
      await add(store.id, variant.id, qty);
      push(`Da them ${qty} ${variant.unit} ${product.name} vao gio`);
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="container section">
      <div className="breadcrumb muted">
        <Link to="/">Trang chu</Link> / <Link to="/products">San pham</Link> / {product.name}
      </div>

      <div className="detail-grid">
        <div className="detail-gallery">
          <div className="detail-main-img">
            {product.images[activeImg] ? (
              <img src={product.images[activeImg].url} alt={product.name} />
            ) : (
              <div className="product-img-ph" style={{ fontSize: 120 }}>NS</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="detail-thumbs">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  className={`detail-thumb ${i === activeImg ? 'active' : ''}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <span className="badge badge-green">{product.category.name}</span>
          <h1>{product.name}</h1>
          <div className="flex gap center detail-meta">
            <span>{product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'Moi'} ({product.ratingCount} danh gia)</span>
            {product.originRegion && <span className="muted">Xuat xu: {product.originRegion}</span>}
          </div>

          <div className="detail-price">
            {variant ? formatVnd(variant.price) : '—'}
            <span className="muted detail-unit">/{variant?.unit}</span>
          </div>

          <div style={{ margin: '12px 0' }}>
            <StorePicker compact />
          </div>

          {product.variants.length > 1 && (
            <div className="variant-row">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  className={`btn btn-sm ${variant?.id === v.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedVariant(v.id)}
                >
                  {v.unit}
                </button>
              ))}
            </div>
          )}

          {hasStore ? (
            <p className={`detail-stock ${available > 0 ? 'in' : 'out'}`}>
              {available > 0
                ? `Con hang tai ${store?.name} (${available} ${variant?.unit})`
                : `Tam het hang tai ${store?.name}`}
            </p>
          ) : (
            <p className="detail-stock muted">Chon khu vuc de xem ton kho va dat hang.</p>
          )}

          <div className="qty-row">
            <div className="qty-stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)}>+</button>
            </div>
            <button
              className="btn btn-primary"
              disabled={!variant || (hasStore && available <= 0) || adding}
              onClick={handleAdd}
            >
              Them vao gio
            </button>
          </div>

          {product.description && <p className="detail-desc">{product.description}</p>}

          {product.attributes.length > 0 && (
            <div className="attr-grid">
              {product.attributes.map((a) => (
                <div key={a.key} className="attr-item">
                  <span className="muted">{a.key}</span>
                  <strong>{a.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="reviews-section">
        <h2>Danh gia ({reviews?.length ?? 0})</h2>
        {reviews && reviews.length > 0 ? (
          <div className="stack gap">
            {reviews.map((r) => (
              <div key={r.id} className="card review-card">
                <div className="between">
                  <strong>{r.user.profile?.fullName ?? 'Khach hang'}</strong>
                  <span>{r.rating}/5</span>
                </div>
                {r.comment && <p className="muted">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Chua co danh gia nao cho san pham nay.</p>
        )}
      </section>

      {related && related.length > 0 && (
        <section className="reviews-section">
          <h2>San pham lien quan</h2>
          <div className="grid product-grid">
            {related.map((p) => (
              <Link key={p.id} to={`/products/${p.slug}`} className="card related-card">
                <div className="related-img">
                  {p.image ? <img src={p.image} alt={p.name} /> : <div className="product-img-ph" style={{ fontSize: 48 }}>NS</div>}
                </div>
                <div className="related-body">
                  <strong className="related-name">{p.name}</strong>
                  <div className="flex between center">
                    <span className="price">{p.fromPrice ? formatVnd(p.fromPrice) : '—'}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{p.ratingAvg > 0 ? p.ratingAvg.toFixed(1) : 'Moi'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
