import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface UserRow {
  id: string; email: string | null; phone: string | null; status: string;
  profile: { fullName: string } | null;
  userRoles: { role: { code: string } }[];
  storeMemberships: { role: string; store: { name: string } }[];
}

const ROLE_FILTERS = [
  { code: '', label: 'Tat ca' },
  { code: 'CUSTOMER', label: 'Khach hang' },
  { code: 'STORE_MANAGER', label: 'Quan ly CH' },
  { code: 'STORE_STAFF', label: 'NV ban hang' },
  { code: 'WAREHOUSE_STAFF', label: 'NV kho' },
  { code: 'SHIPPER', label: 'Shipper' },
  { code: 'ADMIN', label: 'Admin' },
];

const ASSIGNABLE_ROLES = ['CUSTOMER', 'STORE_MANAGER', 'STORE_STAFF', 'WAREHOUSE_STAFF', 'SHIPPER', 'SUPPORT', 'ADMIN'];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [role, setRole] = useState('');
  const [storeId, setStoreId] = useState('');
  const [editing, setEditing] = useState<UserRow | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['admin-stores-lite'],
    queryFn: () =>
      api.get('/admin/stores').then((r) => r.data.data as { id: string; code: string; name: string }[]),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', role, storeId],
    queryFn: () =>
      api
        .get('/admin/users', {
          params: {
            role: role || undefined,
            storeId: storeId || undefined,
          },
        })
        .then((r) => r.data.data as UserRow[]),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => { push('Da cap nhat trang thai'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Nguoi dung & vai tro" subtitle="Quan ly tai khoan va phan quyen" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {ROLE_FILTERS.map((r) => (
          <button key={r.code} className={`dash-btn dash-btn-sm ${role === r.code ? 'dash-btn-primary' : ''}`} onClick={() => setRole(r.code)}>
            {r.label}
          </button>
        ))}
        <select
          className="input"
          style={{ marginLeft: 'auto', maxWidth: 240, height: 34, fontSize: 13 }}
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">Tat ca cua hang</option>
          {stores?.map((s) => (
            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
          ))}
        </select>
      </div>
      <DataTable<UserRow>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', title: 'Ho ten', render: (r) => <strong>{r.profile?.fullName ?? '—'}</strong> },
          { key: 'email', title: 'Email', render: (r) => r.email ?? r.phone ?? '—' },
          { key: 'roles', title: 'Vai tro', render: (r) => r.userRoles.map((ur) => ur.role.code).join(', ') || '—' },
          { key: 'store', title: 'Cua hang', render: (r) => r.storeMemberships.map((m) => m.store.name).join(', ') || '—' },
          { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: 'Thao tac', render: (r) => (
              <div className="dash-row-actions">
                <button className="dash-btn dash-btn-sm" onClick={() => setEditing(r)}>Vai tro</button>
                <button className="dash-btn dash-btn-sm" onClick={() => statusMut.mutate({ id: r.id, status: r.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED' })}>
                  {r.status === 'LOCKED' ? 'Mo khoa' : 'Khoa'}
                </button>
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <RolesModal user={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['admin-users'] }); }} />
      )}
    </>
  );
}

function RolesModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const { push } = useToastStore();
  const [roles, setRoles] = useState<string[]>(user.userRoles.map((ur) => ur.role.code));
  const toggle = (code: string) => setRoles((rs) => rs.includes(code) ? rs.filter((r) => r !== code) : [...rs, code]);

  const mut = useMutation({
    mutationFn: () => api.patch(`/admin/users/${user.id}/roles`, { roles }),
    onSuccess: () => { push('Da cap nhat vai tro'); onDone(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Vai tro: {user.profile?.fullName ?? user.email}</h2>
        <div className="stack gap-sm" style={{ marginTop: 12 }}>
          {ASSIGNABLE_ROLES.map((code) => (
            <label key={code} className="flex gap-sm center">
              <input type="checkbox" checked={roles.includes(code)} onChange={() => toggle(code)} />
              {code}
            </label>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Luu y: gan vai tro cua hang (manager/staff/warehouse/shipper) van can gan vao cua hang cu the o trang Cua hang.
        </p>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Huy</button>
          <button className="btn btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>Luu</button>
        </div>
      </div>
    </div>
  );
}
