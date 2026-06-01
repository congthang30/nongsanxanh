import { Link } from 'react-router-dom';
import { formatVnd } from '../lib/format';
import './product-card.css';

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  originRegion: string | null;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  fromPrice: number | null;
  salePrice?: number | null;
  unit: string | null;
  available?: number;
  category?: { name: string };
}

export function ProductCard({ product }: { product: ProductSummary }) {
  const onSale = product.salePrice != null && product.fromPrice != null;
  const discountPct = onSale
    ? Math.round(
        (1 - (product.salePrice as number) / (product.fromPrice as number)) *
          100,
      )
    : 0;
  const soldOut = product.available != null && product.available <= 0;
  return (
    <Link
      to={`/products/${product.slug}`}
      className="card card-hover product-card fade-up"
    >
      <div className="product-img">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-img-ph">NS</div>
        )}
        {onSale && <span className="flash-badge">-{discountPct}%</span>}
        {soldOut && <span className="soldout-badge">Tạm hết</span>}
        {product.originRegion && (
          <span className="badge badge-green origin-badge">
            {product.originRegion}
          </span>
        )}
      </div>
      <div className="product-body">
        {product.category && (
          <span className="product-cat">{product.category.name}</span>
        )}
        <h3 className="product-name">{product.name}</h3>
        <div className="product-rating">
          {product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'Mới'}
          {product.ratingCount > 0 && (
            <span className="muted"> ({product.ratingCount} đánh giá)</span>
          )}
        </div>
        <div className="product-foot">
          <div>
            {onSale ? (
              <>
                <span className="price product-price product-price-sale">
                  {formatVnd(product.salePrice as number)}
                </span>
                <span className="price-strike">
                  {formatVnd(product.fromPrice as number)}
                </span>
              </>
            ) : (
              <span className="price product-price">
                {product.fromPrice != null
                  ? formatVnd(product.fromPrice)
                  : '—'}
              </span>
            )}
            {product.unit && (
              <span className="muted product-unit">/{product.unit}</span>
            )}
          </div>
          <span className="add-pill" aria-hidden="true">+</span>
        </div>
      </div>
    </Link>
  );
}
