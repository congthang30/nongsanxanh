import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';

interface AuditRow {
  id: string; action: string; targetType: string | null; targetId: string | null;
  storeId: string | null; createdAt: string;
  actor: { email: string | null; profile: { fullName: string } | null } | null;
  metadata: Record<string, unknown> | null;
}

const ACTIONS = [
  '', 'ORDER_STORE_ASSIGNED', 'ORDER_STORE_REASSIGNED', 'ORDER_CANCELLED',
  'ORDER_REFUND', 'INVENTORY_IMPORT', 'INVENTORY_ADJUST', 'DELIVERY_FAILED',
  'STORE_CREATED', 'STORE_MANAGER_ASSIGNED', 'STORE_SHIPPER_ASSIGNED', 'USER_ROLES_UPDATED',
];

export default function AdminAuditPage() {
  const [action, setAction] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', action],
    queryFn: () => api.get('/admin/audit-logs', { params: action ? { action } : {} }).then((r) => r.data.data as AuditRow[]),
  });

  return (
    <>
      <PageHeader title="Nhật ký hệ thống" subtitle="Nhật ký các thao tác nhạy cảm" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 320 }} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Lọc theo hành động">
          {ACTIONS.map((a) => <option key={a} value={a}>{a || 'Tất cả hành động'}</option>)}
        </select>
      </div>
      <DataTable<AuditRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText="Chưa có nhật ký"
        columns={[
          { key: 'time', title: 'Thời gian', render: (r) => <span className="muted">{new Date(r.createdAt).toLocaleString('vi-VN')}</span> },
          { key: 'action', title: 'Hành động', render: (r) => <strong>{r.action}</strong> },
          { key: 'actor', title: 'Người thực hiện', render: (r) => r.actor?.profile?.fullName ?? r.actor?.email ?? 'Hệ thống' },
          { key: 'target', title: 'Đối tượng', render: (r) => r.targetType ? `${r.targetType}` : '—' },
          { key: 'meta', title: 'Chi tiết', render: (r) => <code style={{ fontSize: 11 }}>{r.metadata ? JSON.stringify(r.metadata) : '—'}</code> },
        ]}
      />
    </>
  );
}
