import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface StaffRow {
  id: string; userId: string; fullName: string | null; email: string | null;
  phone: string | null; role: string; status: string; joinedAt: string;
}

export default function StoreManagerStaff() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const { data, isLoading } = useQuery({
    queryKey: ['sm-staff'],
    queryFn: () => api.get('/store-manager/staff').then((r) => r.data.data as StaffRow[]),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch('/store-manager/staff/' + id + '/status', { status }),
    onSuccess: () => {
      push('Đã cập nhật trạng thái nhân viên');
      qc.invalidateQueries({ queryKey: ['sm-staff'] });
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
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
          {
            key: 'action',
            title: 'Cập nhật',
            render: (r) => (
              <select
                className="input"
                style={{ minWidth: 140 }}
                value={r.status}
                disabled={r.role === 'STORE_MANAGER' || updateStatus.isPending}
                onChange={(e) => updateStatus.mutate({ id: r.id, status: e.target.value })}
                aria-label={'Cập nhật trạng thái ' + (r.fullName ?? r.email ?? '')}
              >
                <option value="ACTIVE">Đang làm</option>
                <option value="SUSPENDED">Tạm đình chỉ</option>
                <option value="INACTIVE">Đã nghỉ</option>
              </select>
            ),
          },
        ]}
      />

    </>
  );
}
