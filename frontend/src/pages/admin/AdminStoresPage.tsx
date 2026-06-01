import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { AddressSearchInput, type ResolvedAddress } from '../../components/AddressSearchInput';
import '../../components/address-search.css';

interface StoreRow {
  id: string; code: string; name: string; status: string;
  province: string; district: string | null;
  manager: { id: string; name: string } | null;
  primaryShipper: { id: string; name: string } | null;
  staffCount: number; orderCount: number;
}
interface UserRow { id: string; email: string | null; profile?: { fullName: string } | null; }

export default function AdminStoresPage() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: stores, isLoading } = useQuery({
    queryKey: ['admin-stores'],
    queryFn: () => api.get('/admin/stores').then((r) => r.data.data as StoreRow[]),
  });

  return (
    <>
      <PageHeader
        title="Cửa hàng"
        subtitle="Quản lý chuỗi cửa hàng khu vực"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + Thêm cửa hàng
          </button>
        }
      />

      <DataTable<StoreRow>
        rows={stores ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText="Chưa có cửa hàng nào"
        columns={[
          { key: 'code', title: 'Mã', render: (r) => <strong>{r.code}</strong> },
          { key: 'name', title: 'Tên cửa hàng' },
          { key: 'area', title: 'Khu vực', render: (r) => `${r.district ? r.district + ', ' : ''}${r.province}` },
          { key: 'manager', title: 'Quản lý', render: (r) => r.manager?.name ?? <span className="muted">Chưa gán</span> },
          { key: 'shipper', title: 'Shipper chính', render: (r) => r.primaryShipper?.name ?? <span className="muted">Chưa gán</span> },
          { key: 'staff', title: 'NV', align: 'center', render: (r) => r.staffCount },
          { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: '', render: (r) => (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r.id)}>Quản lý</button>
            ),
          },
        ]}
      />

      {creating && (
        <CreateStoreModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['admin-stores'] }); }}
        />
      )}
      {selected && (
        <StoreDetailModal
          storeId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-stores'] })}
        />
      )}
    </>
  );
}

function CreateStoreModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { push } = useToastStore();
  const [form, setForm] = useState({
    code: '',
    name: '',
    slug: '',
    phone: '',
  });
  const [addr, setAddr] = useState<ResolvedAddress | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: () =>
      api.post('/admin/stores', {
        code: form.code,
        name: form.name,
        slug: form.slug || form.code.toLowerCase(),
        phone: form.phone || undefined,
        // Tach ra tu Nominatim, dam bao 3 cap dia hanh khong rong
        province: addr?.province ?? '',
        district: addr?.district ?? undefined,
        ward: addr?.ward ?? undefined,
        addressLine: addr?.formattedAddress,
        formattedAddress: addr?.formattedAddress,
        lat: addr?.lat,
        lng: addr?.lng,
      }),
    onSuccess: () => { push('Đã tạo cửa hàng'); onCreated(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const canSubmit = !!form.code && !!form.name && !!addr && !createMut.isPending;

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h2>Thêm cửa hàng</h2>
        <div className="dash-form-grid">
          <label>
            Mã cửa hàng
            <input className="input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="BHX-Q2" />
          </label>
          <label>
            Tên
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nông Sản Xanh - Quận 2" />
          </label>
          <label>
            Slug
            <input className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="nsx-quan-2" />
          </label>
          <label>
            SĐT
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 13, color: '#475569', display: 'block', marginBottom: 6 }}>
            Địa chỉ cửa hàng
          </label>
          <AddressSearchInput
            value={addr}
            onChange={setAddr}
            placeholder="Tìm địa chỉ (vd: 123 Lê Lợi, Quận 1, TP.HCM)"
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Hệ thống tự động tách Tỉnh/TP, Quận/Huyện, Phường/Xã và lấy tọa độ từ OpenStreetMap.
          </p>
        </div>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSubmit} onClick={() => createMut.mutate()}>
            Tạo cửa hàng
          </button>
        </div>
      </div>
    </div>
  );
}

interface StoreDetail {
  id: string; code: string; name: string; status: string; province: string; district: string | null;
  manager: { id: string; profile?: { fullName: string } | null; email: string | null } | null;
  primaryShipper: { id: string; profile?: { fullName: string } | null; email: string | null } | null;
  staff: { id: string; role: string; user: { email: string | null; profile?: { fullName: string } | null } }[];
}

function StoreDetailModal({ storeId, onClose, onChanged }: { storeId: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [managerId, setManagerId] = useState('');
  const [shipperId, setShipperId] = useState('');

  const { data: store } = useQuery({
    queryKey: ['admin-store', storeId],
    queryFn: () => api.get(`/admin/stores/${storeId}`).then((r) => r.data.data as StoreDetail),
  });
  const { data: managers } = useQuery({
    queryKey: ['users', 'STORE_MANAGER'],
    queryFn: () => api.get('/admin/users', { params: { role: 'STORE_MANAGER' } }).then((r) => r.data.data as UserRow[]),
  });
  const { data: shippers } = useQuery({
    queryKey: ['users', 'SHIPPER'],
    queryFn: () => api.get('/admin/users', { params: { role: 'SHIPPER' } }).then((r) => r.data.data as UserRow[]),
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-store', storeId] }); onChanged(); };

  const assignManager = useMutation({
    mutationFn: () => api.post(`/admin/stores/${storeId}/assign-manager`, { userId: managerId }),
    onSuccess: () => { push('Đã gán quản lý'); refresh(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const assignShipper = useMutation({
    mutationFn: () => api.post(`/admin/stores/${storeId}/assign-shipper`, { userId: shipperId }),
    onSuccess: () => { push('Đã gán shipper chính'); refresh(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal dash-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2>{store?.name ?? 'Cửa hàng'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button>
        </div>

        <div className="stack gap-lg" style={{ marginTop: 16 }}>
          <section>
            <h4>Quản lý cửa hàng</h4>
            <p className="muted">Hiện tại: {store?.manager?.profile?.fullName ?? store?.manager?.email ?? 'Chưa gán'}</p>
            <div className="flex gap-sm">
              <select className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)} aria-label="Chọn quản lý">
                <option value="">-- Chọn quản lý --</option>
                {managers?.map((m) => <option key={m.id} value={m.id}>{m.profile?.fullName ?? m.email}</option>)}
              </select>
              <button className="btn btn-dark btn-sm" disabled={!managerId} onClick={() => assignManager.mutate()}>Gán</button>
            </div>
          </section>

          <section>
            <h4>Shipper chính</h4>
            <p className="muted">Hiện tại: {store?.primaryShipper?.profile?.fullName ?? store?.primaryShipper?.email ?? 'Chưa gán'}</p>
            <div className="flex gap-sm">
              <select className="input" value={shipperId} onChange={(e) => setShipperId(e.target.value)} aria-label="Chọn shipper">
                <option value="">-- Chọn shipper --</option>
                {shippers?.map((m) => <option key={m.id} value={m.id}>{m.profile?.fullName ?? m.email}</option>)}
              </select>
              <button className="btn btn-dark btn-sm" disabled={!shipperId} onClick={() => assignShipper.mutate()}>Gán</button>
            </div>
          </section>

          <section>
            <h4>Nhân viên ({store?.staff.length ?? 0})</h4>
            <div className="stack gap-sm">
              {store?.staff.map((s) => (
                <div key={s.id} className="between" style={{ padding: '4px 0' }}>
                  <span>{s.user.profile?.fullName ?? s.user.email}</span>
                  <StatusBadge status={s.role} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
