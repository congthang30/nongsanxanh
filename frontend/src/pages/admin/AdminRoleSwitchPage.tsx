import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../dashboard/components/PageHeader';

type AdminViewRole = 'ADMIN' | 'STORE_MANAGER' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER';

const ROLE_OPTIONS: {
  code: AdminViewRole;
  label: string;
  description: string;
  path: string;
  requiresStore: boolean;
}[] = [
  {
    code: 'ADMIN',
    label: 'Quản trị hệ thống',
    description: 'Dữ liệu toàn chuỗi, cửa hàng, tài khoản, sản phẩm và báo cáo quản trị.',
    path: '/admin/dashboard',
    requiresStore: false,
  },
  {
    code: 'STORE_MANAGER',
    label: 'Quản lý chi nhánh',
    description: 'Đơn hàng, tồn kho, nhân viên và báo cáo của chi nhánh đang chọn.',
    path: '/store-manager/dashboard',
    requiresStore: true,
  },
  {
    code: 'STORE_STAFF',
    label: 'Nhân viên bán hàng',
    description: 'Xử lý đơn tại cửa hàng và bán hàng tại quầy.',
    path: '/store/orders',
    requiresStore: true,
  },
  {
    code: 'WAREHOUSE_STAFF',
    label: 'Nhân viên kho',
    description: 'Nhập kho, xuất kho, soạn hàng và kiểm kê tại chi nhánh.',
    path: '/warehouse/dashboard',
    requiresStore: true,
  },
  {
    code: 'SHIPPER',
    label: 'Nhân viên giao hàng',
    description: 'Danh sách giao nhận và cập nhật trạng thái giao hàng.',
    path: '/shipper/dashboard',
    requiresStore: true,
  },
];

export default function AdminRoleSwitchPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<AdminViewRole>(
    () => (localStorage.getItem('adminActiveRole') as AdminViewRole | null) ?? 'ADMIN',
  );
  const activeStoreName = localStorage.getItem('adminActiveStoreName');
  const selected = useMemo(
    () => ROLE_OPTIONS.find((option) => option.code === selectedRole) ?? ROLE_OPTIONS[0],
    [selectedRole],
  );
  const missingStore = selected.requiresStore && !localStorage.getItem('adminActiveStoreId');

  const continueAsRole = () => {
    if (missingStore) return;
    localStorage.setItem('adminActiveRole', selected.code);
    navigate(selected.path);
  };

  return (
    <>
      <PageHeader
        title="Chọn vai trò làm việc"
        subtitle="Admin giữ nguyên quyền quản trị; lựa chọn này chỉ thay đổi giao diện nghiệp vụ đang sử dụng."
      />

      <section
        className="dash-table-card"
        style={{
          width: '100%',
          maxWidth: 680,
          padding: 24,
          alignSelf: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              background: '#dcfce7',
              color: '#166534',
              flex: '0 0 auto',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Bạn muốn làm việc với vai trò nào?</h2>
            <p className="muted" style={{ margin: '5px 0 0', fontSize: 13 }}>
              Quyền Admin vẫn được giữ trong suốt phiên đăng nhập.
            </p>
          </div>
        </div>

        <label style={{ display: 'block', marginTop: 22 }}>
          Vai trò hiển thị
          <select
            className="input"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as AdminViewRole)}
            style={{ width: '100%', marginTop: 7 }}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#f8fafc',
          }}
        >
          <strong style={{ display: 'block', fontSize: 14 }}>{selected.label}</strong>
          <span className="muted" style={{ display: 'block', marginTop: 4, fontSize: 13, lineHeight: 1.6 }}>
            {selected.description}
          </span>
          {selected.requiresStore && (
            <span style={{ display: 'block', marginTop: 8, fontSize: 13, color: missingStore ? '#b91c1c' : '#166534' }}>
              {missingStore
                ? 'Chưa chọn chi nhánh. Hãy chọn ở thanh trên cùng trước khi tiếp tục.'
                : 'Chi nhánh hiện tại: ' + activeStoreName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            className="btn btn-primary flex items-center gap-2"
            disabled={missingStore}
            onClick={continueAsRole}
          >
            Tiếp tục
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </>
  );
}