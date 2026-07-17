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
      to={`/products/${product.id}`}
      className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-premium-hover transition-all duration-500 border border-outline-variant/60 flex flex-col hover:-translate-y-1"
    >
      <div className="relative overflow-hidden aspect-[4/3] bg-surface-container-low flex items-center justify-center">
        {product.image ? (
          <img 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            src={product.image} 
            alt={product.name} 
            loading="lazy" 
          />
        ) : (
          <div className="text-primary font-bold text-lg select-none">NS</div>
        )}
        
        {onSale && (
          <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
            -{discountPct}%
          </div>
        )}
        {!onSale && !soldOut && (
          <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
            Mới
          </div>
        )}
        {soldOut && (
          <div className="absolute top-4 left-4 bg-error text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
            Tạm hết
          </div>
        )}
        
        {product.originRegion && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-on-surface-variant shadow-sm border border-white/50">
            {product.originRegion}
          </div>
        )}
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {product.category && (
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-2 block">
            {product.category.name}
          </span>
        )}
        <h4 className="font-headline-md text-lg font-semibold text-on-surface group-hover:text-primary transition-colors leading-tight mb-2 flex-grow">
          {product.name}
        </h4>
        
        <div className="flex items-center gap-1 text-xs text-outline mb-4">
          <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="font-semibold text-on-surface-variant">
            {product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'Mới'}
          </span>
          {product.ratingCount > 0 && (
            <span>({product.ratingCount})</span>
          )}
        </div>

        <div className="mt-auto pt-6 flex justify-between items-end border-t border-outline-variant/30">
          <div>
            {onSale ? (
              <div className="flex flex-col">
                <span className="font-display-lg text-xl font-bold text-primary">
                  {formatVnd(product.salePrice as number)}
                </span>
                <span className="text-xs line-through text-outline">
                  {formatVnd(product.fromPrice as number)}
                </span>
              </div>
            ) : (
              <span className="font-display-lg text-xl font-bold text-primary">
                {product.fromPrice != null ? formatVnd(product.fromPrice) : '—'}
              </span>
            )}
            {product.unit && (
              <span className="text-sm text-outline ml-1">/{product.unit}</span>
            )}
          </div>
          <button className="w-10 h-10 bg-secondary-container text-primary rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-300 shadow-sm border border-transparent hover:border-primary">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      </div>
    </Link>
  );
}
