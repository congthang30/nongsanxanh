import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuthStore } from '../lib/auth.store';

export function ProtectedRoute({
  children,
  roles,
  requireAdminStore = false,
}: {
  children: ReactNode;
  roles?: string[];
  requireAdminStore?: boolean;
}) {
  const { user, hasRole } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }
  const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
  if (requireAdminStore && isAdmin && !localStorage.getItem('adminActiveStoreId')) {
    return <Navigate to="/admin/switch" replace />;
  }
  return <>{children}</>;
}
