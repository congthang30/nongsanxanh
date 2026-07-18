import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { api } from '../../lib/api';
import { formatVnd } from '../../lib/format';

interface Summary {
  totalOrders: number;
  totalStores: number;
  pendingOrders: number;
  deliveryFailed: number;
  totalUsers: number;
  revenue: number;
  lowStockStoreCount: number;
}

export default function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: () => api.get('/admin/dashboard/summary').then((r) => r.data.data as Summary),
  });

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-headline-lg font-headline-lg text-on-surface">Tổng quan chuỗi cửa hàng</h1>
        <p className="text-body-lg font-body-lg text-on-surface-variant">Theo dõi vận hành toàn hệ thống</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        {/* Card 1: Revenue */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-primary relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-surface-container-highest rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container">
              <Icons.Banknote className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {formatVnd(data?.revenue ?? 0)}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Doanh thu hôm nay</span>
            </div>
          </div>
        </div>

        {/* Card 2: New Orders */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-blue-400 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Icons.Truck className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {data?.totalOrders ?? 0}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Đơn mới</span>
            </div>
          </div>
        </div>

        {/* Card 3: Processing */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-amber-400 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Icons.Clock className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {data?.pendingOrders ?? 0}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Đơn đang xử lý</span>
            </div>
          </div>
        </div>

        {/* Card 4: Failed */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-error relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-error-container rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-error-container flex items-center justify-center text-on-error-container">
              <Icons.XCircle className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {data?.deliveryFailed ?? 0}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Đơn giao thất bại</span>
            </div>
          </div>
        </div>

        {/* Card 5: Low Stock */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-orange-400 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700">
              <Icons.AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {data?.lowStockStoreCount ?? 0}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Cửa hàng sắp hết hàng</span>
            </div>
          </div>
        </div>

        {/* Card 6: Active Stores */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-teal-500 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-teal-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700">
              <Icons.Store className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {data?.totalStores ?? 0}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Cửa hàng hoạt động</span>
            </div>
          </div>
        </div>

        {/* Card 7: Users */}
        <div className="bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border-l-4 border-purple-400 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              <Icons.Users className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md font-headline-md text-on-surface">
                {data?.totalUsers ?? 0}
              </span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Người dùng</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Management Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mt-8">
        {/* Mgt Card 1 */}
        <Link to="/admin/stores" className="block bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border border-transparent hover:border-primary/20 group">
          <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-label-bold font-label-bold text-on-surface group-hover:text-primary transition-colors text-lg">Quản lý cửa hàng</h3>
              <Icons.ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-350" />
            </div>
            <p className="text-label-sm font-label-sm text-on-surface-variant leading-relaxed">
              Thêm cửa hàng, gán quản lý / shipper, khu vực phục vụ
            </p>
          </div>
        </Link>

        {/* Mgt Card 2 */}
        <Link to="/admin/orders" className="block bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border border-transparent hover:border-primary/20 group">
          <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-label-bold font-label-bold text-on-surface group-hover:text-primary transition-colors text-lg">Đơn hàng toàn hệ thống</h3>
              <Icons.ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-350" />
            </div>
            <p className="text-label-sm font-label-sm text-on-surface-variant leading-relaxed">
              Theo dõi, điều chuyển cửa hàng, hoàn tiền
            </p>
          </div>
        </Link>

        {/* Mgt Card 3 */}
        <Link to="/admin/products" className="block bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border border-transparent hover:border-primary/20 group">
          <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-label-bold font-label-bold text-on-surface group-hover:text-primary transition-colors text-lg">Sản phẩm</h3>
              <Icons.ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-350" />
            </div>
            <p className="text-label-sm font-label-sm text-on-surface-variant leading-relaxed">
              Quản lý danh mục sản phẩm chung
            </p>
          </div>
        </Link>

        {/* Mgt Card 4 */}
        <Link to="/admin/reports" className="block bg-surface rounded-xl p-lg organic-shadow organic-shadow-hover transition-all border border-transparent hover:border-primary/20 group">
          <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-label-bold font-label-bold text-on-surface group-hover:text-primary transition-colors text-lg">Báo cáo</h3>
              <Icons.ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-350" />
            </div>
            <p className="text-label-sm font-label-sm text-on-surface-variant leading-relaxed">
              Doanh thu và hiệu suất từng cửa hàng
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}
