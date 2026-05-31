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
      <PageHeader title="Nhat ky he thong" subtitle="Audit log cac hanh dong nhay cam" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 320 }} value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a || 'Tat ca hanh dong'}</option>)}
        </select>
      </div>
      <DataTable<AuditRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'time', title: 'Thoi gian', render: (r) => <span className="muted">{new Date(r.createdAt).toLocaleString('vi-VN')}</span> },
          { key: 'action', title: 'Hanh dong', render: (r) => <strong>{r.action}</strong> },
          { key: 'actor', title: 'Nguoi thuc hien', render: (r) => r.actor?.profile?.fullName ?? r.actor?.email ?? 'He thong' },
          { key: 'target', title: 'Doi tuong', render: (r) => r.targetType ? `${r.targetType}` : '—' },
          { key: 'meta', title: 'Chi tiet', render: (r) => <code style={{ fontSize: 11 }}>{r.metadata ? JSON.stringify(r.metadata) : '—'}</code> },
        ]}
      />
    </>
  );
}
