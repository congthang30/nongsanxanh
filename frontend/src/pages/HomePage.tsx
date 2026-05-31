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

const CATEGORY_META: Record<string, { icon: string; desc: string }> = {
  'rau-cu': { icon: '🥬', desc: 'Rau xanh, sạch, thu hoạch trong ngày' },
  'trai-cay': { icon: '🍊', desc: 'Trái cây theo mùa, ngọt tự nhiên' },
  'gao-hat': { icon: '🌾', desc: 'Gạo ST25, hạt lạc, đậu các loại' },
  'cu-qua': { icon: '🥔', desc: 'Khoai, sắn, củ quả vùng miền' },
};

const BENEFITS = [
  {
    icon: '🚚',
    title: 'Giao nhanh trong ngày',
    desc: 'Tuyến giao ưu tiên nội thành, hàng tươi đến tay bạn',
    tone: 'green',
  },
  {
    icon: '🌿',
    title: 'Truy xuất nguồn gốc',
    desc: 'Rõ vùng trồng, nhà vườn và quy trình thu hoạch',
    tone: 'leaf',
  },
  {
    icon: '❄️',
    title: 'Bảo quản đúng cách',
    desc: 'Vận chuyển lạnh cho rau quả dễ hư khi cần thiết',
    tone: 'sky',
  },
  {
    icon: '🔒',
    title: 'Thanh toán an toàn',
    desc: 'COD tận nhà hoặc VNPay — minh bạch, bảo mật',
    tone: 'amber',
  },
] as const;

const STEPS = [
  { num: '01', title: 'Chọn nông sản', desc: 'Duyệt hàng trăm sản phẩm từ nhà vườn uy tín' },
  { num: '02', title: 'Đặt hàng dễ dàng', desc: 'Thêm giỏ, chọn địa chỉ và phương thức thanh toán' },
  { num: '03', title: 'Nhận hàng tươi', desc: 'Giao nhanh, kiểm tra chất lượng trước khi nhận' },
];

const REGIONS = [
  { name: 'Đà Lạt', emoji: '🏔️', tag: 'Rau & dâu' },
  { name: 'Vĩnh Long', emoji: '🌊', tag: 'Khoai & trái cây' },
  { name: 'Tiền Giang', emoji: '🥭', tag: 'Xoài & trái nhiệt' },
  { name: 'Sóc Trăng', emoji: '🌾', tag: 'Gạo ST25' },
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
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-grid-pattern" />
        </div>

        <div className="container hero-inner">
          <div className="hero-copy fade-up">
            <div className="hero-badge-row">
              <span className="hero-badge">🌱 Tươi từ vườn</span>
              <span className="hero-badge hero-badge-outline">Chuẩn VietGAP</span>
            </div>

            <h1>
              Nông sản sạch,
              <span className="hero-accent"> giao tận nhà</span>
            </h1>

            <p className="hero-sub">
              Trái cây, rau củ, gạo và đặc sản vùng miền — truy xuất nguồn gốc rõ ràng,
              thu hoạch và giao trong ngày.
            </p>

            <form className="hero-search" onSubmit={handleSearch}>
              <span className="hero-search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="hero-search-input"
                placeholder="Tìm rau củ, trái cây, gạo ST25..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                aria-label="Tìm kiếm sản phẩm"
              />
              <button type="submit" className="btn btn-primary hero-search-btn">
                Tìm kiếm
              </button>
            </form>

            <div className="hero-tags">
              {['Rau cu', 'Trai cay', 'Gao ST25', 'Dac san'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="hero-tag"
                  onClick={() => navigate(`/products?q=${encodeURIComponent(tag)}`)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="hero-stats">
              {[
                ['500+', 'San pham'],
                ['3', 'Cua hang khu vuc'],
                ['24h', 'Giao nhanh'],
              ].map(([val, label]) => (
                <div key={label} className="hero-stat">
                  <strong>{val}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-visual fade-up" aria-hidden="true">
            <div className="hero-showcase">
              <div className="showcase-main">
                <span className="showcase-emoji">🥭</span>
                <div className="showcase-label">
                  <strong>Xoài Cát Hòa Lộc</strong>
                  <span>Tiền Giang · Mùa vàng</span>
                </div>
              </div>
              <div className="showcase-card showcase-card-a">
                <span>🍅</span>
                <div>
                  <strong>Cà chua hữu cơ</strong>
                  <small>Đà Lạt</small>
                </div>
              </div>
              <div className="showcase-card showcase-card-b">
                <span>🌾</span>
                <div>
                  <strong>Gạo ST25</strong>
                  <small>Sóc Trăng</small>
                </div>
              </div>
              <div className="showcase-card showcase-card-c">
                <span>🥑</span>
                <div>
                  <strong>Bơ sáp</strong>
                  <small>Đắk Lắk</small>
                </div>
              </div>
              <div className="showcase-badge">
                <span>⚡</span> Giao trong ngày
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="trust-strip">
        <div className="container trust-strip-inner">
          {[
            '✓ Thu hoạch trong ngày',
            '✓ Truy xuất nguồn gốc',
            '✓ Đổi trả trong 24h',
            '✓ COD & VNPay',
          ].map((item) => (
            <span key={item} className="trust-item">{item}</span>
          ))}
        </div>
      </div>

      {/* Categories */}
      <section className="section home-categories">
        <div className="container">
          <div className="section-intro">
            <div>
              <span className="section-label">Danh mục</span>
              <h2>Mua theo loại nông sản</h2>
              <p className="muted">Chon danh muc phu hop, giao nhanh tu cua hang gan ban</p>
            </div>
            <Link to="/products" className="btn btn-ghost btn-sm hide-mobile">
              Xem tất cả →
            </Link>
          </div>

          <div className="cat-grid">
            {(categories ?? []).map((cat) => {
              const meta = CATEGORY_META[cat.slug] ?? { icon: '🌿', desc: 'Nông sản tươi sạch' };
              return (
                <Link
                  key={cat.id}
                  to={`/products?categoryId=${cat.id}`}
                  className="cat-card fade-up"
                >
                  <span className="cat-icon">{meta.icon}</span>
                  <div className="cat-body">
                    <strong>{cat.name}</strong>
                    <p className="muted">{meta.desc}</p>
                  </div>
                  <span className="cat-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
            {!categories && (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="cat-card skeleton" style={{ height: 100 }} />
              ))
            )}
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
              <p className="muted">Tuoi ngon, chon loc moi ngay tu cac cua hang trong khu vuc</p>
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
            <p className="muted">Đơn giản, nhanh chóng — từ vườn đến bàn ăn của bạn</p>
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

      {/* Benefits */}
      <section className="section home-benefits">
        <div className="container">
          <div className="benefits-grid">
            {BENEFITS.map((b) => (
              <div key={b.title} className={`benefit-card benefit-${b.tone}`}>
                <span className="benefit-icon">{b.icon}</span>
                <div>
                  <strong>{b.title}</strong>
                  <p className="muted">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regions */}
      <section className="section home-regions">
        <div className="container">
          <div className="section-intro">
            <div>
              <span className="section-label">Vùng miền</span>
              <h2>Đặc sản từ khắp cả nước</h2>
              <p className="muted">Cua hang khu vuc phuc vu nhanh tan noi</p>
            </div>
          </div>

          <div className="region-grid">
            {REGIONS.map((r) => (
              <Link
                key={r.name}
                to={`/products?q=${encodeURIComponent(r.name)}`}
                className="region-card fade-up"
              >
                <span className="region-emoji">{r.emoji}</span>
                <strong>{r.name}</strong>
                <span className="region-tag">{r.tag}</span>
              </Link>
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
              <p>Khám phá hàng trăm nông sản tươi — giao nhanh, truy xuất rõ ràng, giá minh bạch.</p>
              <div className="flex gap">
                <Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>
                <Link to="/login" className="btn btn-ghost cta-ghost">Tạo tài khoản</Link>
              </div>
            </div>
            <div className="cta-art" aria-hidden="true">
              <span>🥬</span>
              <span>🍊</span>
              <span>🌾</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
