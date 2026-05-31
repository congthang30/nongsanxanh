import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface StoreRow {
  id: string; code: string; name: string; status: string;
  province: string; district: string | null;
  manager: { id: string; name: string } | null;
  primaryShipper: { id: string; name: string } | null;
  serviceAreaCount: number; staffCount: number; orderCount: number;
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
        title="Cua hang"
        subtitle="Quan ly chuoi cua hang khu vuc"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + Them cua hang
          </button>
        }
      />

      <DataTable<StoreRow>
        rows={stores ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', title: 'Ma', render: (r) => <strong>{r.code}</strong> },
          { key: 'name', title: 'Ten cua hang' },
          { key: 'area', title: 'Khu vuc', render: (r) => `${r.district ? r.district + ', ' : ''}${r.province}` },
          { key: 'manager', title: 'Quan ly', render: (r) => r.manager?.name ?? <span className="muted">Chua gan</span> },
          { key: 'shipper', title: 'Shipper chinh', render: (r) => r.primaryShipper?.name ?? <span className="muted">Chua gan</span> },
          { key: 'staff', title: 'NV', align: 'center', render: (r) => r.staffCount },
          { key: 'areas', title: 'Khu vuc PV', align: 'center', render: (r) => r.serviceAreaCount },
          { key: 'status', title: 'Trang thai', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: '', render: (r) => (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r.id)}>Quan ly</button>
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
    code: '', name: '', slug: '', province: 'TP.HCM', district: '', ward: '',
    addressLine: '', phone: '', lat: '', lng: '',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: () => api.post('/admin/stores', {
      code: form.code, name: form.name, slug: form.slug || form.code.toLowerCase(),
      province: form.province, district: form.district || undefined, ward: form.ward || undefined,
      addressLine: form.addressLine || undefined, phone: form.phone || undefined,
      lat: form.lat ? Number(form.lat) : undefined, lng: form.lng ? Number(form.lng) : undefined,
    }),
    onSuccess: () => { push('Da tao cua hang'); onCreated(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Them cua hang</h2>
        <div className="dash-form-grid">
          <label>Ma cua hang<input className="input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="BHX-Q2" /></label>
          <label>Ten<input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="NongSan Xanh - Quan 2" /></label>
          <label>Slug<input className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="nsx-quan-2" /></label>
          <label>SDT<input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label>Tinh/TP<input className="input" value={form.province} onChange={(e) => set('province', e.target.value)} /></label>
          <label>Quan/Huyen<input className="input" value={form.district} onChange={(e) => set('district', e.target.value)} /></label>
          <label>Phuong/Xa<input className="input" value={form.ward} onChange={(e) => set('ward', e.target.value)} /></label>
          <label>Dia chi<input className="input" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} /></label>
          <label>Vi do (lat)<input className="input" value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="10.78" /></label>
          <label>Kinh do (lng)<input className="input" value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="106.70" /></label>
        </div>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Huy</button>
          <button className="btn btn-primary" disabled={!form.code || !form.name || createMut.isPending} onClick={() => createMut.mutate()}>
            Tao cua hang
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
  serviceAreas: { id: string; province: string; district: string | null; ward: string | null }[];
  staff: { id: string; role: string; user: { email: string | null; profile?: { fullName: string } | null } }[];
}

function StoreDetailModal({ storeId, onClose, onChanged }: { storeId: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [managerId, setManagerId] = useState('');
  const [shipperId, setShipperId] = useState('');
  const [area, setArea] = useState({ province: 'TP.HCM', district: '' });

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
    onSuccess: () => { push('Da gan quan ly'); refresh(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const assignShipper = useMutation({
    mutationFn: () => api.post(`/admin/stores/${storeId}/assign-shipper`, { userId: shipperId }),
    onSuccess: () => { push('Da gan shipper chinh'); refresh(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const addArea = useMutation({
    mutationFn: () => api.post(`/admin/stores/${storeId}/service-areas`, { province: area.province, district: area.district || undefined }),
    onSuccess: () => { push('Da them khu vuc phuc vu'); refresh(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const removeArea = useMutation({
    mutationFn: (areaId: string) => api.delete(`/admin/stores/${storeId}/service-areas/${areaId}`),
    onSuccess: () => { push('Da xoa khu vuc'); refresh(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal dash-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2>{store?.name ?? 'Cua hang'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Dong</button>
        </div>

        <div className="stack gap-lg" style={{ marginTop: 16 }}>
          <section>
            <h4>Quan ly cua hang</h4>
            <p className="muted">Hien tai: {store?.manager?.profile?.fullName ?? store?.manager?.email ?? 'Chua gan'}</p>
            <div className="flex gap-sm">
              <select className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">-- Chon quan ly --</option>
                {managers?.map((m) => <option key={m.id} value={m.id}>{m.profile?.fullName ?? m.email}</option>)}
              </select>
              <button className="btn btn-dark btn-sm" disabled={!managerId} onClick={() => assignManager.mutate()}>Gan</button>
            </div>
          </section>

          <section>
            <h4>Shipper chinh</h4>
            <p className="muted">Hien tai: {store?.primaryShipper?.profile?.fullName ?? store?.primaryShipper?.email ?? 'Chua gan'}</p>
            <div className="flex gap-sm">
              <select className="input" value={shipperId} onChange={(e) => setShipperId(e.target.value)}>
                <option value="">-- Chon shipper --</option>
                {shippers?.map((m) => <option key={m.id} value={m.id}>{m.profile?.fullName ?? m.email}</option>)}
              </select>
              <button className="btn btn-dark btn-sm" disabled={!shipperId} onClick={() => assignShipper.mutate()}>Gan</button>
            </div>
          </section>

          <section>
            <h4>Khu vuc phuc vu</h4>
            <div className="stack gap-sm">
              {store?.serviceAreas.map((a) => (
                <div key={a.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>{a.ward ? a.ward + ', ' : ''}{a.district ? a.district + ', ' : ''}{a.province}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeArea.mutate(a.id)}>Xoa</button>
                </div>
              ))}
              {store?.serviceAreas.length === 0 && <p className="muted">Chua co khu vuc phuc vu.</p>}
            </div>
            <div className="flex gap-sm" style={{ marginTop: 10 }}>
              <input className="input" placeholder="Tinh/TP" value={area.province} onChange={(e) => setArea((a) => ({ ...a, province: e.target.value }))} />
              <input className="input" placeholder="Quan/Huyen (tuy chon)" value={area.district} onChange={(e) => setArea((a) => ({ ...a, district: e.target.value }))} />
              <button className="btn btn-dark btn-sm" onClick={() => addArea.mutate()}>Them</button>
            </div>
          </section>

          <section>
            <h4>Nhan vien ({store?.staff.length ?? 0})</h4>
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
