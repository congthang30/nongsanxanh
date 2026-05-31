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
      <PageHeader title="Nhan vien cua hang" subtitle="Danh sach nhan su lam viec tai cua hang" />
      <DataTable<StaffRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', title: 'Ho ten', render: (r) => <strong>{r.fullName ?? r.email}</strong> },
          { key: 'email', title: 'Email', render: (r) => r.email ?? '—' },
          { key: 'phone', title: 'SDT', render: (r) => r.phone ?? '—' },
          { key: 'role', title: 'Vai tro', render: (r) => <StatusBadge status={r.role} /> },
          { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'joined', title: 'Ngay vao', render: (r) => <span className="muted">{new Date(r.joinedAt).toLocaleDateString('vi-VN')}</span> },
        ]}
      />
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        De them/go nhan vien, lien he Admin (trang Cua hang).
      </p>
    </>
  );
}
