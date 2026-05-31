import { Routes, Route, Navigate } from 'react-router-dom';
import { CustomerLayout } from './components/layout/CustomerLayout';
import { ToastHost } from './components/ToastHost';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import ProductListPage from './pages/ProductListPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import PaymentReturnPage from './pages/PaymentReturnPage';

// Dashboard shell
import { DashboardLayout } from './dashboard/layout/DashboardLayout';

// Admin
import AdminDashboard from './dashboard/pages/AdminDashboard';
import AdminStoresPage from './pages/admin/AdminStoresPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminInventoryPage from './pages/admin/AdminInventoryPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminAuditPage from './pages/admin/AdminAuditPage';

// Store manager
import StoreManagerDashboard from './dashboard/pages/StoreManagerDashboard';
import StoreManagerOrders from './dashboard/pages/StoreManagerOrders';
import StoreManagerInventory from './dashboard/pages/StoreManagerInventory';
import StoreManagerStaff from './dashboard/pages/StoreManagerStaff';
import StoreManagerReports from './dashboard/pages/StoreManagerReports';

// Store staff
import StoreStaffOrders from './dashboard/pages/StoreStaffOrders';

// Warehouse
import WarehouseDashboard from './dashboard/pages/WarehouseDashboard';
import WarehousePick from './dashboard/pages/WarehousePick';
import WarehouseInventory from './dashboard/pages/WarehouseInventory';

// Shipper
import ShipperDashboard from './dashboard/pages/ShipperDashboard';
import ShipperConsolePage from './pages/shipper/ShipperConsolePage';

// Support
import StaffDashboardPage from './dashboard/pages/StaffDashboard';
import SupportConsolePage from './pages/support/SupportConsolePage';

// POS (cashier terminal + manager reports)
import POSTerminalPage from './pos/POSTerminalPage';
import POSReportsPage from './dashboard/pages/POSReportsPage';

const ADMIN = ['ADMIN', 'SUPER_ADMIN'];

export default function App() {
  return (
    <>
      <ToastHost />
      <Routes>
        {/* ============ STOREFRONT (Customer) ============ */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/payment/vnpay/return" element={<PaymentReturnPage />} />

          <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        </Route>

        {/* ============ ADMIN ============ */}
        <Route
          element={
            <ProtectedRoute roles={ADMIN}>
              <DashboardLayout allowed={ADMIN as never} />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/stores" element={<AdminStoresPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
        </Route>

        {/* ============ STORE MANAGER ============ */}
        <Route
          element={
            <ProtectedRoute roles={['STORE_MANAGER', ...ADMIN]}>
              <DashboardLayout allowed={['STORE_MANAGER', ...ADMIN] as never} />
            </ProtectedRoute>
          }
        >
          <Route path="/store-manager" element={<Navigate to="/store-manager/dashboard" replace />} />
          <Route path="/store-manager/dashboard" element={<StoreManagerDashboard />} />
          <Route path="/store-manager/orders" element={<StoreManagerOrders />} />
          <Route path="/store-manager/inventory" element={<StoreManagerInventory />} />
          <Route path="/store-manager/staff" element={<StoreManagerStaff />} />
          <Route path="/store-manager/reports" element={<StoreManagerReports />} />
          <Route path="/store-manager/pos-reports" element={<POSReportsPage />} />
        </Route>

        {/* ============ STORE STAFF ============ */}
        <Route
          element={
            <ProtectedRoute roles={['STORE_STAFF', 'STORE_MANAGER', ...ADMIN]}>
              <DashboardLayout allowed={['STORE_STAFF', 'STORE_MANAGER', ...ADMIN] as never} />
            </ProtectedRoute>
          }
        >
          <Route path="/store" element={<Navigate to="/store/orders" replace />} />
          <Route path="/store/orders" element={<StoreStaffOrders />} />
        </Route>

        {/* ============ POS CASHIER TERMINAL (full-screen) ============ */}
        <Route
          path="/pos"
          element={
            <ProtectedRoute roles={['STORE_STAFF', 'STORE_MANAGER', ...ADMIN]}>
              <POSTerminalPage />
            </ProtectedRoute>
          }
        />

        {/* ============ WAREHOUSE ============ */}
        <Route
          element={
            <ProtectedRoute roles={['WAREHOUSE_STAFF', 'STORE_MANAGER', ...ADMIN]}>
              <DashboardLayout allowed={['WAREHOUSE_STAFF', 'STORE_MANAGER', ...ADMIN] as never} />
            </ProtectedRoute>
          }
        >
          <Route path="/warehouse" element={<Navigate to="/warehouse/dashboard" replace />} />
          <Route path="/warehouse/dashboard" element={<WarehouseDashboard />} />
          <Route path="/warehouse/pick" element={<WarehousePick />} />
          <Route path="/warehouse/inventory" element={<WarehouseInventory />} />
        </Route>

        {/* ============ SHIPPER ============ */}
        <Route
          element={
            <ProtectedRoute roles={['SHIPPER', ...ADMIN]}>
              <DashboardLayout allowed={['SHIPPER', ...ADMIN] as never} />
            </ProtectedRoute>
          }
        >
          <Route path="/shipper" element={<Navigate to="/shipper/dashboard" replace />} />
          <Route path="/shipper/dashboard" element={<ShipperDashboard />} />
          <Route path="/shipper/active" element={<ShipperConsolePage scope="active" />} />
          <Route path="/shipper/history" element={<ShipperConsolePage scope="history" />} />
        </Route>

        {/* ============ SUPPORT ============ */}
        <Route
          element={
            <ProtectedRoute roles={['SUPPORT', ...ADMIN]}>
              <DashboardLayout allowed={['SUPPORT', ...ADMIN] as never} />
            </ProtectedRoute>
          }
        >
          <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
          <Route path="/staff/tickets" element={<SupportConsolePage />} />
        </Route>

        {/* Legacy redirects */}
        <Route path="/seller" element={<Navigate to="/" replace />} />
        <Route path="/seller/*" element={<Navigate to="/" replace />} />
        <Route path="/shops/*" element={<Navigate to="/products" replace />} />
        <Route path="/admin/dispatch" element={<Navigate to="/admin/orders" replace />} />
        <Route path="/admin/shops" element={<Navigate to="/admin/stores" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
