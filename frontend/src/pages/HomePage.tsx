import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ProductCard, ProductSummary } from '../components/ProductCard';
import './home.css';

interface ProductListResponse {
  data: ProductSummary[];
  meta: { total: number };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const TRUST_CHIPS = [
  'Tự kiểm tồn trước khi đặt',
  'Giao từ cửa hàng phù hợp',
  'COD hoặc VNPay',
];

const STEPS = [
  { num: '01', title: 'Chọn nông sản', desc: 'Duyệt rau củ, trái cây và đồ thiết yếu tươi mỗi ngày.' },
  { num: '02', title: 'Nhập địa chỉ giao', desc: 'Hệ thống tự chọn cửa hàng phù hợp gần bạn còn đủ hàng.' },
  { num: '03', title: 'Nhận hàng tươi', desc: 'Cửa hàng soạn hàng và shipper giao tận nơi.' },
];

const FEATURES = [
  {
    title: 'Giao nhanh trong ngày',
    desc: 'Tuyến giao ưu tiên nội thành, hàng tươi đến tay bạn.',
    path: 'M3 13l2-7h11l3 4h2v3M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  },
  {
    title: 'Truy xuất nguồn gốc',
    desc: 'Rõ vùng trồng, nhà vườn và quy trình thu hoạch.',
    path: 'M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Zm-1 12-3-3 1.4-1.4L11 11.2l4.6-4.6L17 8l-6 6Z',
  },
  {
    title: 'Tồn kho minh bạch',
    desc: 'Kiểm tồn theo địa chỉ giao trước khi đặt, tránh thiếu hàng.',
    path: 'M4 4h16v4H4V4Zm0 6h16v10H4V10Zm4 3v4h8v-4H8Z',
  },
  {
    title: 'Thanh toán an toàn',
    desc: 'COD tận nhà hoặc VNPay, minh bạch và bảo mật.',
    path: 'M2 6h20v12H2V6Zm0 4h20M6 15h4',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'home'],
    queryFn: () =>
      api.get('/products', { params: { limit: 8 } }).then((r) => r.data as ProductListResponse),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data as Category[]),
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQ.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy fade-up">
            <span className="hero-eyebrow">Chuỗi cửa hàng nông sản tươi</span>
            <h1>
              Nông sản tươi
              <span className="hero-accent"> mỗi ngày</span>
            </h1>
            <p className="hero-sub">
              Đặt rau củ, trái cây và đồ thiết yếu. Hệ thống tự chọn cửa hàng
              phù hợp gần bạn có đủ hàng.
            </p>

            <form className="hero-search" onSubmit={handleSearch}>
              <span className="hero-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                className="hero-search-input"
                placeholder="Tìm rau củ, trái cây, gạo ST25..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                aria-label="Tìm kiếm sản phẩm"
              />
              <button type="submit" className="btn btn-primary hero-search-btn">
                Tìm
              </button>
            </form>

            <div className="hero-cta-row">
              <Link to="/products" className="btn btn-primary">Mua ngay</Link>
              <Link to="/orders" className="btn btn-ghost">Xem đơn hàng</Link>
            </div>

            <ul className="hero-trust">
              {TRUST_CHIPS.map((chip) => (
                <li key={chip} className="hero-trust-chip">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          <div className="hero-visual fade-up">
            <img
              className="hero-img"
              src="/hero-produce.png"
              alt="Rau củ, trái cây và đồ thiết yếu tươi"
              loading="eager"
            />
            <div className="hero-img-badge">
              <span className="hero-img-badge-dot" />
              Giao trong ngày
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section home-categories">
        <div className="container">
          <div className="section-intro">
            <div>
              <span className="section-label">Danh mục</span>
              <h2>Mua theo loại nông sản</h2>
              <p className="muted">Chọn danh mục phù hợp, hệ thống giao từ cửa hàng gần bạn.</p>
            </div>
            <Link to="/products" className="btn btn-ghost btn-sm hide-mobile">
              Xem tất cả
            </Link>
          </div>

          <div className="cat-grid">
            {(categories ?? []).map((cat) => (
              <Link
                key={cat.id}
                to={`/products?categoryId=${cat.id}`}
                className="cat-card fade-up"
              >
                <span className="cat-badge" aria-hidden="true">{cat.name.charAt(0)}</span>
                <div className="cat-body">
                  <strong>{cat.name}</strong>
                </div>
                <span className="cat-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
            {!categories &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="cat-card skeleton" style={{ height: 76 }} />
              ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="section home-featured" id="featured">
        <div className="container">
          <div className="section-intro">
            <div>
              <span className="section-label">Nổi bật</span>
              <h2>Sản phẩm được yêu thích</h2>
              <p className="muted">Tươi ngon, chọn lọc mỗi ngày từ các cửa hàng trong hệ thống.</p>
            </div>
            <Link to="/products" className="btn btn-primary btn-sm">
              Xem tất cả
            </Link>
          </div>

          {isLoading ? (
            <div className="grid product-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 300, borderRadius: 16 }} />
              ))}
            </div>
          ) : (
            <div className="grid product-grid">
              {data?.data.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="section home-steps">
        <div className="container">
          <div className="section-intro center-block">
            <span className="section-label">Quy trình</span>
            <h2>Mua nông sản chỉ 3 bước</h2>
            <p className="muted">Bạn chỉ cần chọn hàng và nhập địa chỉ, phần còn lại để hệ thống lo.</p>
          </div>

          <div className="steps-grid">
            {STEPS.map((step, i) => (
              <div key={step.num} className="step-card fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p className="muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section home-features">
        <div className="container">
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.path} />
                  </svg>
                </span>
                <div>
                  <strong>{f.title}</strong>
                  <p className="muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta">
        <div className="container">
          <div className="cta-inner">
            <div className="cta-copy">
              <span className="section-label section-label-light">Bắt đầu ngay</span>
              <h2>Sẵn sàng ăn sạch, sống khỏe?</h2>
              <p>Khám phá hàng trăm nông sản tươi, giao nhanh từ cửa hàng phù hợp với bạn.</p>
              <div className="flex gap">
                <Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>
                <Link to="/register" className="btn btn-ghost cta-ghost">Tạo tài khoản</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
