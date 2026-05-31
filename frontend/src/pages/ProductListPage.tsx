import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../lib/api';
import { ProductCard, ProductSummary } from '../components/ProductCard';

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

  const { data, isLoading } = useQuery({
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
      <div className="stack gap" style={{ marginBottom: 28 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h1>San pham nong san</h1>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setParam('q', q); }}
          className="flex gap-sm"
          style={{ maxWidth: 520 }}
        >
          <input
            className="input"
            placeholder="Tim rau cu, trai cay, gao..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-dark" type="submit">Tim</button>
        </form>
      </div>

      <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          className={`btn btn-sm ${!categoryId ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setParam('categoryId', '')}
        >
          Tat ca
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
        >
          <option value="newest">Moi nhat</option>
          <option value="rating">Danh gia cao</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid product-grid">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="grid product-grid">
          {data.data.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">
            Khong tim thay san pham phu hop.
          </p>
        </div>
      )}
    </div>
  );
}
