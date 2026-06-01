import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../lib/api';
import { ProductCard, ProductSummary } from '../components/ProductCard';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

interface Category { id: string; name: string; slug: string; }
interface ProductListResponse { data: ProductSummary[]; meta: { total: number; page: number; totalPages: number }; }

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const categoryId = searchParams.get('categoryId') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data as Category[]),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', { q: searchParams.get('q'), categoryId, sort }],
    queryFn: () => {
      return api
        .get('/products', {
          params: {
            q: searchParams.get('q') || undefined,
            categoryId: categoryId || undefined,
            sort,
            limit: 24,
          },
        })
        .then((r) => r.data as ProductListResponse);
    },
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <div className="container section">
      <div className="stack gap" style={{ marginBottom: 20 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h1>Sản phẩm nông sản</h1>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setParam('q', q); }}
          className="flex gap-sm"
          style={{ maxWidth: 520 }}
        >
          <input
            className="input"
            placeholder="Tìm rau củ, trái cây, gạo..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm sản phẩm"
          />
          <button className="btn btn-dark" type="submit">Tìm</button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>
          Tồn kho được kiểm tra theo địa chỉ giao hàng ở bước thanh toán.
        </p>
      </div>

      <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <button
          className={`btn btn-sm ${!categoryId ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setParam('categoryId', '')}
        >
          Tất cả
        </button>
        {categories?.map((c) => (
          <button
            key={c.id}
            className={`btn btn-sm ${categoryId === c.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setParam('categoryId', c.id)}
          >
            {c.name}
          </button>
        ))}
        <select
          className="input"
          style={{ width: 'auto', marginLeft: 'auto' }}
          value={sort}
          onChange={(e) => setParam('sort', e.target.value)}
          aria-label="Sắp xếp"
        >
          <option value="newest">Mới nhất</option>
          <option value="rating">Đánh giá cao</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid product-grid">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 300, borderRadius: 16 }} />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data && data.data.length > 0 ? (
        <div className="grid product-grid">
          {data.data.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy sản phẩm phù hợp"
          description="Thử đổi từ khóa hoặc danh mục khác."
        />
      )}
    </div>
  );
}
