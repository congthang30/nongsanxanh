import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ProductCard, ProductSummary } from '../components/ProductCard';
import { ScrollReveal } from '../components/ScrollReveal';
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
  'Tự kiểm soát khi đặt',
  'Giao từ cửa hàng gần nhất',
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
    icon: 'local_shipping',
  },
  {
    title: 'Truy xuất nguồn gốc',
    desc: 'Rõ vùng trồng, nhà vườn và quy trình thu hoạch.',
    icon: 'verified',
  },
  {
    title: 'Tồn kho minh bạch',
    desc: 'Kiểm tồn theo địa chỉ giao trước khi đặt, tránh thiếu hàng.',
    icon: 'inventory_2',
  },
  {
    title: 'Thanh toán an toàn',
    desc: 'COD tận nhà hoặc VNPay, minh bạch và bảo mật.',
    icon: 'payments',
  },
];

const getCategoryIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('rau') || n.includes('củ')) return 'restaurant_menu';
  if (n.includes('trái') || n.includes('quả') || n.includes('bơ') || n.includes('xoài')) return 'nutrition';
  if (n.includes('gạo') || n.includes('hạt') || n.includes('bột')) return 'grain';
  if (n.includes('thịt') || n.includes('trứng') || n.includes('cá') || n.includes('sữa')) return 'egg';
  return 'eco';
};

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
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden hero-bg">
        <div className="max-w-container-max mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <ScrollReveal variant="left" className="z-10 text-left" once>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full mb-8 shadow-sm border border-secondary-container/50">
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
              <span className="font-label-bold text-xs tracking-wide">CHUỖI CỬA HÀNG NÔNG SẢN TƯƠI</span>
            </div>

            <h2 className="font-display-lg text-5xl lg:text-6xl font-bold mb-6 text-on-surface leading-tight tracking-tight">
              Nông sản tươi <br />
              <span className="text-gradient-green">mỗi ngày</span>
            </h2>
            <p className="font-body-lg text-lg text-on-surface-variant mb-10 max-w-lg leading-relaxed">
              Đặt rau củ, trái cây và đồ thiết yếu. Hệ thống tự chọn cửa hàng phù hợp gần bạn nhất để đảm
              bảo độ tươi ngon vượt trội.
            </p>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-10 max-w-xl">
              <div className="flex-1 flex items-center bg-white shadow-premium px-6 py-4 rounded-full border border-outline-variant/50 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-300">
                <span className="material-symbols-outlined text-outline mr-3">search</span>
                <input
                  className="flex-1 bg-transparent border-none focus:ring-0 font-body-md text-on-surface placeholder:text-outline focus:outline-none"
                  placeholder="Tìm rau củ, trái cây, gạo ST25..."
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                <button
                  type="submit"
                  className="hidden sm:block px-6 py-2 bg-primary text-white rounded-full font-label-bold hover:bg-primary-container transition-colors shadow-sm"
                >
                  Tìm kiếm
                </button>
              </div>
            </form>

            <div className="flex flex-wrap gap-4 items-center">
              <Link
                to="/products"
                className="px-8 py-3.5 bg-primary text-white rounded-full font-label-bold text-base hover:bg-primary-container shadow-premium hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300 text-center"
              >
                Mua ngay
              </Link>
              <Link
                to="/orders"
                className="px-8 py-3.5 bg-white border border-outline-variant text-on-surface rounded-full font-label-bold text-base hover:border-primary hover:text-primary shadow-sm hover:shadow-premium transition-all duration-300 text-center"
              >
                Xem đơn hàng
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-on-surface-variant border-t border-outline-variant/50 pt-8 max-w-xl">
              {TRUST_CHIPS.map((chip) => (
                <div key={chip} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                  <span className="font-medium text-sm">{chip}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal variant="right" delay={120} className="relative lg:ml-auto w-full max-w-lg" once>
            <div className="rounded-3xl overflow-hidden shadow-soft border border-white/20 transform lg:-rotate-2 hover:rotate-0 transition-transform duration-700 ease-out">
              <img
                className="w-full h-auto object-cover"
                alt="A lush and vibrant top-down flat-lay photograph of fresh vegetables and fruits"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCi8ThdWSJk0XPgNM6oHpC2ECGDaAaPXvABBUiHK4rd4UgnSX7YvZHVDF1uvqS_OnaI07ullQ2VpqN-YJ-NuXW692TIG2_W9cwEZENE7Tm7shAs1YmhqiYiUqHGgHyIB6YUhJ3OOqqt6TnvsWtCx_N4QkDIt3BIacX7S3ppVQZ5DNuU735apRhsHEADBzPzxr_H9711l1TsI-OdYqecxoopwUl0H9CucDFakPttfZg45bfKqCrDLhdkpA"
              />
              <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-full shadow-premium border border-white/50 flex items-center gap-3">
                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse"></div>
                <span className="font-label-bold text-on-surface text-sm">Giao trong ngày</span>
              </div>
            </div>
            <div className="absolute -z-10 -top-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute -z-10 -bottom-10 -left-10 w-48 h-48 bg-primary/5 rounded-full blur-2xl"></div>
          </ScrollReveal>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 bg-white border-y border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-6 md:px-10">
          <ScrollReveal variant="up" className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-12">
            <div className="text-left">
              <span className="font-label-bold text-primary uppercase tracking-widest text-xs font-semibold">
                Danh mục
              </span>
              <h3 className="font-display-lg text-3xl font-bold mt-3 text-on-surface tracking-tight">
                Mua theo loại nông sản
              </h3>
              <p className="text-on-surface-variant font-body-md mt-3 text-base max-w-2xl">
                Chọn danh mục phù hợp, hệ thống giao từ cửa hàng gần bạn.
              </p>
            </div>
            <Link
              to="/products"
              className="group flex items-center gap-2 px-5 py-2.5 bg-surface-container-low border border-transparent rounded-full text-on-surface font-label-bold hover:bg-white hover:border-outline-variant hover:shadow-sm transition-all duration-300 w-fit"
            >
              Xem tất cả
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </Link>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories ? (
              categories.map((cat, index) => (
                <ScrollReveal key={cat.id} variant="scale" delay={index * 70}>
                  <Link
                    to={`/products?categoryId=${cat.id}`}
                    className="group bg-surface-container-low/50 p-6 rounded-2xl border border-outline-variant/50 hover:bg-white hover:shadow-premium hover:border-primary/20 transition-all duration-300 flex justify-between items-center h-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-secondary-container flex items-center justify-center rounded-xl text-primary group-hover:scale-110 transition-transform duration-300">
                        <span
                          className="material-symbols-outlined text-[28px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {getCategoryIcon(cat.name)}
                        </span>
                      </div>
                      <span className="font-headline-md text-lg font-semibold text-on-surface">{cat.name}</span>
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">
                      chevron_right
                    </span>
                  </Link>
                </ScrollReveal>
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-surface-container-low p-6 rounded-2xl border border-outline-variant/50 h-[88px]"
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-background">
        <div className="max-w-container-max mx-auto px-6 md:px-10">
          <ScrollReveal variant="up" className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-12">
            <div>
              <span className="font-label-bold text-primary uppercase tracking-widest text-xs font-semibold">
                Nổi bật
              </span>
              <h3 className="font-display-lg text-3xl font-bold mt-3 text-on-surface tracking-tight">
                Sản phẩm được yêu thích
              </h3>
              <p className="text-on-surface-variant font-body-md mt-3 text-base">
                Tươi ngon, chọn lọc mỗi ngày từ các cửa hàng trong hệ thống.
              </p>
            </div>
            <Link
              to="/products"
              className="bg-primary text-white px-6 py-2.5 rounded-full font-label-bold hover:bg-primary-container shadow-premium hover:shadow-premium-hover transition-all duration-300 w-fit text-center"
            >
              Xem tất cả
            </Link>
          </ScrollReveal>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-white rounded-3xl h-[420px] border border-outline-variant/60"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {data?.data.map((p, index) => (
                <ScrollReveal key={p.id} variant="up" delay={(index % 4) * 80}>
                  <ProductCard product={p} />
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-24 bg-white border-t border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-6 md:px-10">
          <ScrollReveal variant="up" className="text-center max-w-xl mx-auto mb-16">
            <span className="font-label-bold text-primary uppercase tracking-widest text-xs font-semibold">
              Quy trình
            </span>
            <h3 className="font-display-lg text-3xl font-bold mt-3 text-on-surface tracking-tight">
              Mua nông sản chỉ 3 bước
            </h3>
            <p className="text-on-surface-variant font-body-md mt-3 text-base">
              Bạn chỉ cần chọn hàng và nhập địa chỉ, phần còn lại để hệ thống lo.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, index) => (
              <ScrollReveal key={step.num} variant="up" delay={index * 100}>
                <div className="bg-background/40 p-8 rounded-3xl border border-outline-variant/50 relative overflow-hidden group hover:bg-white hover:shadow-premium hover:border-primary/20 transition-all duration-300 h-full">
                  <div className="text-gradient-green text-5xl font-black mb-6 opacity-30 group-hover:opacity-100 transition-opacity duration-300">
                    {step.num}
                  </div>
                  <h4 className="font-headline-md text-xl font-bold text-on-surface mb-3">{step.title}</h4>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background border-t border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((f, index) => (
              <ScrollReveal key={f.title} variant="scale" delay={index * 80}>
                <div className="bg-white p-6 rounded-2xl border border-outline-variant/50 flex gap-4 items-start shadow-sm hover:shadow-premium transition-all duration-300 h-full">
                  <div className="w-10 h-10 bg-secondary-container text-primary flex items-center justify-center rounded-xl flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
                  </div>
                  <div>
                    <h5 className="font-headline-md text-base font-bold text-on-surface mb-1">{f.title}</h5>
                    <p className="text-on-surface-variant text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white border-t border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-6 md:px-10">
          <ScrollReveal variant="scale">
            <div className="bg-gradient-to-r from-primary to-primary-container rounded-[2.5rem] p-12 md:p-20 text-white relative overflow-hidden shadow-premium">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-82 h-82 bg-white/5 rounded-full blur-2xl -ml-20 -mb-20"></div>

              <div className="relative z-10 max-w-2xl">
                <span className="font-label-bold text-xs uppercase tracking-widest bg-white/20 text-white px-4 py-1.5 rounded-full inline-block mb-6">
                  Bắt đầu ngay
                </span>
                <h3 className="font-display-lg text-4xl md:text-5xl font-bold mb-6 leading-tight">
                  Sẵn sàng ăn sạch, sống khỏe?
                </h3>
                <p className="text-white/80 font-body-lg text-base md:text-lg mb-10 leading-relaxed">
                  Khám phá hàng trăm nông sản tươi ngon, chọn lọc và giao nhanh từ hệ thống cửa hàng nông sản
                  gần bạn nhất.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    to="/products"
                    className="px-8 py-3.5 bg-white text-primary rounded-full font-label-bold text-base hover:bg-secondary-container hover:-translate-y-0.5 transition-all duration-300 text-center shadow-md"
                  >
                    Mua sắm ngay
                  </Link>
                  <Link
                    to="/register"
                    className="px-8 py-3.5 bg-transparent border border-white/40 text-white rounded-full font-label-bold text-base hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300 text-center"
                  >
                    Tạo tài khoản
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
