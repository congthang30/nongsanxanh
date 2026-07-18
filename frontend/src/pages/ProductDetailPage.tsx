import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Tags } from 'lucide-react';
import { api } from '../lib/api';
import { formatVnd } from '../lib/format';
import { useCartStore } from '../lib/cart.store';
import { useToastStore } from '../lib/toast.store';
import { getErrorMessage } from '../lib/api';
import './product-detail.css';

interface Variant {
  id: string; sku: string; unit: string; price: number;
  compareAtPrice: number | null; available: number; storeCoverage?: number;
  stores?: { id: string; name: string; available: number }[];
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
interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  fromPrice: number | null;
  unit: string | null;
  ratingAvg: number;
}
interface RelatedProductsResponse {
  byEmbedding: RelatedProduct[];
  byCategory: RelatedProduct[];
  preview: RelatedProduct[];
}

export default function ProductDetailPage() {
  // Route: /products/:slug — param co the la slug hoac UUID (ProductCard link bang id)
  const { slug } = useParams();
  const identifier = slug?.trim() ?? '';
  const { add } = useCartStore();
  const { push } = useToastStore();
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);

  // San pham la global cua he thong; ton kho hien thi la GOP toan he thong.
  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['product', identifier],
    enabled: !!identifier,
    queryFn: () =>
      api.get(`/products/${encodeURIComponent(identifier)}`).then((r) => r.data.data as ProductDetail),
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', product?.id],
    enabled: !!product?.id,
    queryFn: () => api.get(`/products/${product!.id}/reviews`).then((r) => r.data.data as Review[]),
  });

  const { data: related } = useQuery({
    queryKey: ['related', identifier],
    enabled: !!identifier,
    queryFn: () =>
      api
        .get(`/products/${encodeURIComponent(identifier)}/related`)
        .then((r) => r.data.data as RelatedProductsResponse),
  });

  const relatedPreview = related?.preview ?? [];
  const relatedEmbedding = related?.byEmbedding ?? [];
  const relatedCategory = related?.byCategory ?? [];
  const relatedTotal = useMemo(() => {
    const ids = new Set<string>();
    for (const p of relatedEmbedding) ids.add(p.id);
    for (const p of relatedCategory) ids.add(p.id);
    return ids.size;
  }, [relatedEmbedding, relatedCategory]);
  const hasMoreRelated = relatedTotal > relatedPreview.length;

  if (isLoading) {
    return (
      <div className="container section">
        <div className="skeleton" style={{ height: 420 }} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container section">
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Không tải được sản phẩm</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            {isError ? getErrorMessage(error) : 'Không tìm thấy sản phẩm hoặc đường dẫn không hợp lệ.'}
          </p>
          <div className="flex gap center" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-ghost" to="/products">
              Về danh sách
            </Link>
            {isError && (
              <button type="button" className="btn btn-primary" onClick={() => refetch()}>
                Thử lại
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const variant = product.variants.find((v) => v.id === selectedVariant) ?? product.variants[0];
  const available = variant?.available ?? 0;
  const inStock = available > 0;

  const handleAdd = async () => {
    if (!variant) return;
    if (!inStock) { push('Sản phẩm này hiện tạm hết hàng', 'error'); return; }
    setAdding(true);
    try {
      await add(variant.id, qty);
      push(`Đã thêm ${qty} ${variant.unit} ${product.name} vào giỏ`);
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="container section">
      <div className="breadcrumb muted">
        <Link to="/">Trang chủ</Link> / <Link to="/products">Sản phẩm</Link> / {product.name}
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
            <span>{product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'Mới'} ({product.ratingCount} đánh giá)</span>
            {product.originRegion && <span className="muted">Xuất xứ: {product.originRegion}</span>}
          </div>

          <div className="detail-price">
            {variant ? formatVnd(variant.price) : '—'}
            <span className="muted detail-unit">/{variant?.unit}</span>
          </div>

          <div style={{ margin: '12px 0' }}>
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
          </div>

          <p className={`detail-stock ${inStock ? 'in' : 'out'}`}>
            {inStock
              ? 'Có thể đặt - giao từ cửa hàng phù hợp gần bạn'
              : 'Tạm hết hàng ở các cửa hàng gần bạn'}
            {inStock && variant?.storeCoverage != null && variant.storeCoverage > 0 && (
              <span className="muted" style={{ marginLeft: 8, fontSize: 13, fontWeight: 400 }}>
                · Có sẵn tại {variant.storeCoverage} cửa hàng
              </span>
            )}
          </p>

          {inStock && variant?.stores && variant.stores.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: '#6d7b6c', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Có sẵn tại các chi nhánh:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {variant.stores.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      backgroundColor: '#f4f8f5',
                      border: '1px solid #bccbb9',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#111c2c',
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#006e2f' }}></span>
                    {s.name} (còn {s.available} {variant.unit})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="qty-row">
            <div className="qty-stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)}>+</button>
            </div>
            <button
              className="btn btn-primary"
              disabled={!variant || !inStock || adding}
              onClick={handleAdd}
            >
              Thêm vào giỏ
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
        <h2>Đánh giá ({reviews?.length ?? 0})</h2>
        {reviews && reviews.length > 0 ? (
          <div className="stack gap">
            {reviews.map((r) => (
              <div key={r.id} className="card review-card">
                <div className="between">
                  <strong>{r.user.profile?.fullName ?? 'Khách hàng'}</strong>
                  <span>{r.rating}/5</span>
                </div>
                {r.comment && <p className="muted">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa có đánh giá nào cho sản phẩm này.</p>
        )}
      </section>

      <section className="reviews-section related-section">
        <div className="related-section-head">
          <h2>Sản phẩm liên quan</h2>
          {relatedTotal > 0 && (
            <span className="muted related-count">{relatedTotal} gợi ý</span>
          )}
        </div>

        {relatedTotal === 0 ? (
          <p className="muted">Hiện tại không có sản phẩm liên quan nào.</p>
        ) : !showAllRelated ? (
          <>
            <div className="grid product-grid related-grid">
              {relatedPreview.map((p) => (
                <RelatedProductCard key={p.id} product={p} />
              ))}
            </div>
            {hasMoreRelated && (
              <div className="related-more-wrap">
                <button
                  type="button"
                  className="btn btn-ghost related-more-btn"
                  onClick={() => setShowAllRelated(true)}
                >
                  Xem thêm
                  <ChevronDown size={16} aria-hidden />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="related-group">
              <div className="related-group-head">
                <span className="related-group-icon" aria-hidden>
                  <Sparkles size={18} />
                </span>
                <div>
                  <h3 className="related-group-title">Gợi ý tương tự</h3>
                  <p className="related-group-desc muted">
                    Gợi ý thông minh dựa trên độ giống nội dung (tên, mô tả, xuất xứ…) so với sản phẩm
                    bạn đang xem — không chỉ cùng nhóm hàng.
                  </p>
                </div>
              </div>
              {relatedEmbedding.length > 0 ? (
                <div className="grid product-grid related-grid">
                  {relatedEmbedding.map((p) => (
                    <RelatedProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <p className="muted related-empty">Chưa có gợi ý tương tự cho sản phẩm này.</p>
              )}
            </div>

            <div className="related-group">
              <div className="related-group-head">
                <span className="related-group-icon related-group-icon-cat" aria-hidden>
                  <Tags size={18} />
                </span>
                <div>
                  <h3 className="related-group-title">
                    Cùng danh mục{product.category?.name ? `: ${product.category.name}` : ''}
                  </h3>
                  <p className="related-group-desc muted">
                    Các sản phẩm khác thuộc cùng nhóm/danh mục, ưu tiên đánh giá cao và còn hàng.
                  </p>
                </div>
              </div>
              {relatedCategory.length > 0 ? (
                <div className="grid product-grid related-grid">
                  {relatedCategory.map((p) => (
                    <RelatedProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <p className="muted related-empty">Không có sản phẩm khác trong cùng danh mục.</p>
              )}
            </div>

            <div className="related-more-wrap">
              <button
                type="button"
                className="btn btn-ghost related-more-btn"
                onClick={() => setShowAllRelated(false)}
              >
                Thu gọn
                <ChevronUp size={16} aria-hidden />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function RelatedProductCard({ product: p }: { product: RelatedProduct }) {
  return (
    <Link to={`/products/${p.slug}`} className="card related-card">
      <div className="related-img">
        {p.image ? (
          <img src={p.image} alt={p.name} />
        ) : (
          <div className="product-img-ph" style={{ fontSize: 48 }}>
            NS
          </div>
        )}
      </div>
      <div className="related-body">
        <strong className="related-name">{p.name}</strong>
        <div className="flex between center">
          <span className="price">{p.fromPrice ? formatVnd(p.fromPrice) : '—'}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {p.ratingAvg > 0 ? p.ratingAvg.toFixed(1) : 'Mới'}
          </span>
        </div>
      </div>
    </Link>
  );
}
