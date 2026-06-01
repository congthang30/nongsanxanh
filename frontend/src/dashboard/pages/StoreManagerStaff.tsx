import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface StaffRow {
  id: string; userId: string; fullName: string | null; email: string | null;
  phone: string | null; role: string; status: string; joinedAt: string;
}

export default function StoreManagerStaff() {
  const { data, isLoading } = useQuery({
    queryKey: ['sm-staff'],
    queryFn: () => api.get('/store-manager/staff').then((r) => r.data.data as StaffRow[]),
  });

  return (
    <>
      <PageHeader title="Nhân viên cửa hàng" subtitle="Danh sách nhân sự làm việc tại cửa hàng" />
      <DataTable<StaffRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText="Chưa có nhân viên"
        columns={[
          { key: 'name', title: 'Họ tên', render: (r) => <strong>{r.fullName ?? r.email}</strong> },
          { key: 'email', title: 'Email', render: (r) => r.email ?? '—' },
          { key: 'phone', title: 'SĐT', render: (r) => r.phone ?? '—' },
          { key: 'role', title: 'Vai trò', render: (r) => <StatusBadge status={r.role} /> },
          { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'joined', title: 'Ngày vào', render: (r) => <span className="muted">{new Date(r.joinedAt).toLocaleDateString('vi-VN')}</span> },
        ]}
      />
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Để thêm/gỡ nhân viên, liên hệ Admin (trang Cửa hàng).
      </p>
    </>
  );
}
