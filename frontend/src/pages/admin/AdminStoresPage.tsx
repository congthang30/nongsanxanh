import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Info,
  Plus,
  Search,
  Store,
  Trash2,
  Truck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { AddressSearchInput, type ResolvedAddress } from '../../components/AddressSearchInput';
import { ModalPortal } from '../../components/ModalPortal';
import '../../components/address-search.css';
import './admin.css';

interface StoreRow {
  id: string;
  code: string;
  name: string;
  status: string;
  province: string;
  district: string | null;
  manager: { id: string; name: string } | null;
  primaryShipper: { id: string; name: string } | null;
  staffCount: number;
  orderCount: number;
}
interface UserRow {
  id: string;
  email: string | null;
  profile?: { fullName: string; avatarUrl?: string | null } | null;
}

export default function AdminStoresPage() {
  const qc = useQueryClient();
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
          {
            key: 'area',
            title: 'Khu vực',
            render: (r) => `${r.district ? r.district + ', ' : ''}${r.province}`,
          },
          {
            key: 'manager',
            title: 'Quản lý',
            render: (r) => r.manager?.name ?? <span className="muted">Chưa gán</span>,
          },
          {
            key: 'shipper',
            title: 'Shipper chính',
            render: (r) => r.primaryShipper?.name ?? <span className="muted">Chưa gán</span>,
          },
          { key: 'staff', title: 'NV', align: 'center', render: (r) => r.staffCount },
          { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act',
            title: '',
            render: (r) => (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r.id)}>
                Quản lý
              </button>
            ),
          },
        ]}
      />

      {creating && (
        <CreateStoreModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['admin-stores'] });
          }}
        />
      )}
      {selected && (
        <StoreDetailPanel
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
        province: addr?.province ?? '',
        district: addr?.district ?? undefined,
        ward: addr?.ward ?? undefined,
        addressLine: addr?.formattedAddress,
        formattedAddress: addr?.formattedAddress,
        lat: addr?.lat,
        lng: addr?.lng,
      }),
    onSuccess: () => {
      push('Đã tạo cửa hàng');
      onCreated();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const canSubmit = !!form.code && !!form.name && !!addr && !createMut.isPending;

  return (
    <ModalPortal>
    <div className="dash-modal-overlay" onClick={onClose}>
      <div
        className="dash-modal store-create-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-create-title"
      >
        <header className="store-create-modal-head">
          <h2 id="store-create-title">Thêm cửa hàng</h2>
          <p className="muted store-create-modal-sub">
            Nhập thông tin cơ bản và địa chỉ. Hệ thống sẽ tách khu vực từ địa chỉ đã chọn.
          </p>
        </header>

        <div className="store-create-grid">
          <div className="store-create-field">
            <label htmlFor="store-create-code">Mã cửa hàng</label>
            <input
              id="store-create-code"
              className="input"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="BHX-Q2"
              autoComplete="off"
            />
          </div>
          <div className="store-create-field">
            <label htmlFor="store-create-name">Tên</label>
            <input
              id="store-create-name"
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nông Sản Xanh - Quận 2"
            />
          </div>
          <div className="store-create-field">
            <label htmlFor="store-create-slug">Slug</label>
            <input
              id="store-create-slug"
              className="input"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="nsx-quan-2"
              autoComplete="off"
            />
          </div>
          <div className="store-create-field">
            <label htmlFor="store-create-phone">SĐT</label>
            <input
              id="store-create-phone"
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="0901234567"
              inputMode="tel"
            />
          </div>
          <div className="store-create-field store-create-field-full">
            <label htmlFor="store-create-address">Địa chỉ cửa hàng</label>
            <AddressSearchInput
              value={addr}
              onChange={setAddr}
              placeholder="Tìm địa chỉ (vd: 123 Lê Lợi, Quận 1, TP.HCM)"
            />
            <p className="muted store-create-hint">
              Hệ thống tự động tách Tỉnh/TP, Quận/Huyện, Phường/Xã và lấy tọa độ từ OpenStreetMap.
            </p>
          </div>
        </div>

        <footer className="store-create-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? 'Đang tạo...' : 'Tạo cửa hàng'}
          </button>
        </footer>
      </div>
    </div>
    </ModalPortal>
  );
}

interface StoreDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  province: string;
  district: string | null;
  manager: { id: string; profile?: { fullName: string } | null; email: string | null } | null;
  primaryShipper: { id: string; profile?: { fullName: string } | null; email: string | null } | null;
  staff: {
    id: string;
    role: string;
    status: string;
    user: {
      id: string;
      email: string | null;
      phone?: string | null;
      profile?: { fullName: string; avatarUrl?: string | null } | null;
    };
  }[];
}

function StoreDetailPanel({
  storeId,
  onClose,
  onChanged,
}: {
  storeId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [managerId, setManagerId] = useState('');
  const [shipperId, setShipperId] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [staffRole, setStaffRole] = useState<'STORE_STAFF' | 'WAREHOUSE_STAFF'>('STORE_STAFF');
  const [editName, setEditName] = useState('');
  const [storeStatus, setStoreStatus] = useState('');
  const [staffQuery, setStaffQuery] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [reassignManager, setReassignManager] = useState(false);
  const [reassignShipper, setReassignShipper] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ['admin-store', storeId],
    queryFn: () => api.get(`/admin/stores/${storeId}`).then((r) => r.data.data as StoreDetail),
  });
  const { data: managers } = useQuery({
    queryKey: ['users', 'STORE_MANAGER'],
    queryFn: () =>
      api.get('/admin/users', { params: { role: 'STORE_MANAGER' } }).then((r) => r.data.data as UserRow[]),
  });
  const { data: shippers } = useQuery({
    queryKey: ['users', 'SHIPPER'],
    queryFn: () =>
      api.get('/admin/users', { params: { role: 'SHIPPER' } }).then((r) => r.data.data as UserRow[]),
  });
  const { data: staffUsers } = useQuery({
    queryKey: ['users', staffRole],
    queryFn: () =>
      api.get('/admin/users', { params: { role: staffRole } }).then((r) => r.data.data as UserRow[]),
  });

  useEffect(() => {
    if (!store) return;
    setEditName(store.name);
    setStoreStatus(store.status);
  }, [store?.id, store?.name, store?.status]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-store', storeId] });
    onChanged();
  };

  const assignManager = useMutation({
    mutationFn: () => api.post(`/admin/stores/${storeId}/assign-manager`, { userId: managerId }),
    onSuccess: () => {
      push('Đã gán quản lý');
      setManagerId('');
      setReassignManager(false);
      refresh();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const assignShipper = useMutation({
    mutationFn: () => api.post(`/admin/stores/${storeId}/assign-shipper`, { userId: shipperId }),
    onSuccess: () => {
      push('Đã gán shipper chính');
      setShipperId('');
      setReassignShipper(false);
      refresh();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const updateStore = useMutation({
    mutationFn: () =>
      api.patch('/admin/stores/' + storeId, {
        name: editName || store?.name,
        status: storeStatus || store?.status,
      }),
    onSuccess: () => {
      push('Đã cập nhật cửa hàng');
      refresh();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const closeStore = useMutation({
    mutationFn: () => api.delete('/admin/stores/' + storeId),
    onSuccess: () => {
      push('Đã đóng cửa hàng');
      onChanged();
      onClose();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const addStaff = useMutation({
    mutationFn: () =>
      api.post('/admin/stores/' + storeId + '/staff', {
        userId: staffUserId,
        role: staffRole,
      }),
    onSuccess: () => {
      push('Đã thêm nhân viên');
      setStaffUserId('');
      setShowAddStaff(false);
      refresh();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const updateStaff = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: string; status?: string } }) =>
      api.patch('/admin/stores/' + storeId + '/staff/' + id, patch),
    onSuccess: () => {
      push('Đã cập nhật nhân viên');
      refresh();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  const removeStaff = useMutation({
    mutationFn: (id: string) => api.delete('/admin/stores/' + storeId + '/staff/' + id),
    onSuccess: () => {
      push('Đã gỡ nhân viên');
      refresh();
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const teamStaff = useMemo(() => {
    const rows = (store?.staff ?? []).filter(
      (s) => s.role !== 'STORE_MANAGER' && s.role !== 'SHIPPER',
    );
    const q = staffQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) => {
      const name = s.user.profile?.fullName ?? '';
      const email = s.user.email ?? '';
      const phone = s.user.phone ?? '';
      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q)
      );
    });
  }, [store?.staff, staffQuery]);

  const dirty =
    !!store &&
    (editName.trim() !== store.name || (storeStatus || store.status) !== store.status);

  const resetForm = () => {
    if (!store) return;
    setEditName(store.name);
    setStoreStatus(store.status);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Hoạt động';
      case 'PAUSED':
        return 'Tạm dừng';
      case 'SUSPENDED':
        return 'Đình chỉ';
      case 'CLOSED':
        return 'Đã đóng';
      default:
        return status;
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'STORE_STAFF':
        return 'Bán hàng';
      case 'WAREHOUSE_STAFF':
        return 'Kho';
      case 'STORE_MANAGER':
        return 'Quản lý';
      case 'SHIPPER':
        return 'Shipper';
      default:
        return role;
    }
  };

  const managerName =
    store?.manager?.profile?.fullName ?? store?.manager?.email ?? 'Chưa gán';
  const shipperName =
    store?.primaryShipper?.profile?.fullName ?? store?.primaryShipper?.email ?? 'Chưa gán';

  return (
    <ModalPortal>
    <div className="store-panel-overlay" onClick={onClose} role="presentation">
      <div
        className="store-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quản lý chi tiết cửa hàng"
      >
        <div className="store-panel-header">
          <div>
            <h2
              className="text-headline-md font-headline-md text-on-surface"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                margin: 0,
                fontSize: 22,
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              <Store size={22} color="#006e2f" style={{ flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {store?.name ?? (isLoading ? 'Đang tải...' : 'Cửa hàng')}
              </span>
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                color: '#3d4a3d',
                fontSize: 14,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              Quản lý chuỗi cửa hàng khu vực
              {store?.code ? ` · ${store.code}` : ''}
              {store?.province
                ? ` · ${store.district ? `${store.district}, ` : ''}${store.province}`
                : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {store && (
              <span className="store-status-pill">
                <span className="store-status-dot" />
                {statusLabel(store.status)}
              </span>
            )}
            <button type="button" className="store-icon-btn" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="store-panel-body">
          <section>
            <h3 className="store-section-title">
              <Info size={20} color="#3d4a3d" />
              Thông tin cơ bản
            </h3>
            <div className="store-grid-2">
              <div className="store-field-card">
                <label className="store-field-label" htmlFor="store-name">
                  Tên cửa hàng
                </label>
                <input
                  id="store-name"
                  className="store-field-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Tên cửa hàng"
                />
              </div>
              <div className="store-field-card">
                <label className="store-field-label" htmlFor="store-status">
                  Trạng thái
                </label>
                <select
                  id="store-status"
                  className="store-field-select"
                  value={storeStatus || store?.status || 'ACTIVE'}
                  onChange={(e) => setStoreStatus(e.target.value)}
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="PAUSED">Tạm dừng</option>
                  <option value="SUSPENDED">Đình chỉ</option>
                  <option value="CLOSED">Đã đóng</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h3 className="store-section-title">
              <UserCog size={20} color="#3d4a3d" />
              Nhân sự quản lý chốt
            </h3>
            <div className="store-grid-2">
              <div className="store-role-card">
                <div className="store-role-card-main">
                  <div className="store-avatar store-avatar-primary">
                    <UserCog size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#3d4a3d' }}>Quản lý cửa hàng</p>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 500,
                        color: '#111c2c',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {managerName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="store-icon-btn"
                  title="Đổi quản lý"
                  aria-label="Đổi quản lý"
                  onClick={() => setReassignManager((v) => !v)}
                >
                  <ArrowLeftRight size={18} />
                </button>
              </div>

              <div className="store-role-card">
                <div className="store-role-card-main">
                  <div className="store-avatar store-avatar-secondary">
                    <Truck size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#3d4a3d' }}>Shipper chính</p>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 500,
                        color: '#111c2c',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {shipperName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="store-icon-btn"
                  title="Đổi shipper chính"
                  aria-label="Đổi shipper chính"
                  onClick={() => setReassignShipper((v) => !v)}
                >
                  <ArrowLeftRight size={18} />
                </button>
              </div>
            </div>

            {reassignManager && (
              <div className="store-field-card" style={{ marginTop: 12 }}>
                <label className="store-field-label">Gán quản lý mới</label>
                <div className="store-inline-row">
                  <select
                    className="store-inline-select"
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    aria-label="Chọn quản lý"
                  >
                    <option value="">-- Chọn quản lý --</option>
                    {managers?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.profile?.fullName ?? m.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="store-primary-btn"
                    style={{ padding: '8px 16px' }}
                    disabled={!managerId || assignManager.isPending}
                    onClick={() => assignManager.mutate()}
                  >
                    Gán
                  </button>
                </div>
              </div>
            )}

            {reassignShipper && (
              <div className="store-field-card" style={{ marginTop: 12 }}>
                <label className="store-field-label">Gán shipper chính mới</label>
                <div className="store-inline-row">
                  <select
                    className="store-inline-select"
                    value={shipperId}
                    onChange={(e) => setShipperId(e.target.value)}
                    aria-label="Chọn shipper"
                  >
                    <option value="">-- Chọn shipper --</option>
                    {shippers?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.profile?.fullName ?? m.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="store-primary-btn"
                    style={{ padding: '8px 16px' }}
                    disabled={!shipperId || assignShipper.isPending}
                    onClick={() => assignShipper.mutate()}
                  >
                    Gán
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="store-team-section">
            <h3 className="store-section-title">
              <Users size={20} color="#3d4a3d" />
              Đội ngũ nhân viên ({teamStaff.length}
              {staffQuery
                ? ` / ${(store?.staff ?? []).filter((s) => s.role !== 'STORE_MANAGER' && s.role !== 'SHIPPER').length}`
                : ''}
              )
            </h3>

            <div className="store-toolbar">
              <div className="store-search">
                <Search className="store-search-icon" size={16} aria-hidden />
                <input
                  type="search"
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Tìm theo tên, email hoặc SĐT..."
                  aria-label="Tìm nhân viên"
                />
              </div>
              <button
                type="button"
                className="store-add-btn"
                onClick={() => setShowAddStaff((v) => !v)}
              >
                <Plus size={16} aria-hidden />
                {showAddStaff ? 'Ẩn form' : '+ Thêm'}
              </button>
            </div>

            {showAddStaff && (
              <div className="store-field-card" style={{ marginBottom: 16 }}>
                <label className="store-field-label">Thêm nhân viên vào cửa hàng</label>
                <div className="store-inline-row">
                  <select
                    className="store-inline-select"
                    value={staffRole}
                    onChange={(e) => {
                      setStaffRole(e.target.value as 'STORE_STAFF' | 'WAREHOUSE_STAFF');
                      setStaffUserId('');
                    }}
                  >
                    <option value="STORE_STAFF">Nhân viên bán hàng</option>
                    <option value="WAREHOUSE_STAFF">Nhân viên kho</option>
                  </select>
                  <select
                    className="store-inline-select"
                    value={staffUserId}
                    onChange={(e) => setStaffUserId(e.target.value)}
                    aria-label="Chọn tài khoản nhân viên"
                  >
                    <option value="">-- Chọn tài khoản --</option>
                    {staffUsers?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.profile?.fullName ?? u.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="store-primary-btn"
                    style={{ padding: '8px 16px' }}
                    disabled={!staffUserId || addStaff.isPending}
                    onClick={() => addStaff.mutate()}
                  >
                    Thêm
                  </button>
                </div>
              </div>
            )}

            <div className="store-staff-table-wrap">
              <table className="store-staff-table">
                <thead>
                  <tr>
                    <th scope="col">Nhân viên</th>
                    <th scope="col">SĐT</th>
                    <th scope="col">Email</th>
                    <th scope="col">Vai trò</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="store-staff-table-empty">
                        {staffQuery
                          ? 'Không tìm thấy nhân viên phù hợp'
                          : 'Chưa có nhân viên bán hàng / kho'}
                      </td>
                    </tr>
                  ) : (
                    teamStaff.map((s) => {
                      const name = s.user.profile?.fullName ?? s.user.email ?? 'Nhân viên';
                      const avatarUrl = s.user.profile?.avatarUrl;
                      return (
                        <tr key={s.id}>
                          <td>
                            <div className="store-staff-name-cell">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt=""
                                  className="store-avatar"
                                  style={{ objectFit: 'cover' }}
                                />
                              ) : (
                                <div className="store-avatar store-avatar-muted" aria-hidden>
                                  {initials(name)}
                                </div>
                              )}
                              <span className="store-staff-name-text">{name}</span>
                            </div>
                          </td>
                          <td className="store-staff-cell-muted">
                            {s.user.phone?.trim() || '—'}
                          </td>
                          <td className="store-staff-cell-muted">
                            {s.user.email ?? '—'}
                          </td>
                          <td>
                            <select
                              className="store-inline-select"
                              value={s.role}
                              onChange={(e) =>
                                updateStaff.mutate({ id: s.id, patch: { role: e.target.value } })
                              }
                              aria-label={`Vai trò ${name}`}
                            >
                              <option value="STORE_STAFF">Bán hàng</option>
                              <option value="WAREHOUSE_STAFF">Kho</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="store-inline-select"
                              value={s.status}
                              onChange={(e) =>
                                updateStaff.mutate({ id: s.id, patch: { status: e.target.value } })
                              }
                              aria-label={`Trạng thái ${name}`}
                            >
                              <option value="ACTIVE">Đang làm</option>
                              <option value="SUSPENDED">Tạm đình chỉ</option>
                              <option value="INACTIVE">Đã nghỉ</option>
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="store-remove-btn"
                              onClick={() => {
                                if (confirm('Gỡ nhân viên khỏi cửa hàng?')) removeStaff.mutate(s.id);
                              }}
                            >
                              <Trash2 size={14} />
                              Gỡ
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="store-panel-footer">
          <button
            type="button"
            className="store-danger-secondary-btn"
            disabled={store?.status === 'CLOSED' || closeStore.isPending}
            onClick={() => {
              if (confirm('Đóng cửa hàng này?')) closeStore.mutate();
            }}
          >
            Đóng cửa hàng
          </button>
          <div className="store-panel-footer-main">
            <button
              type="button"
              className="store-ghost-btn"
              onClick={dirty ? resetForm : onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="store-primary-btn"
              disabled={!dirty || updateStore.isPending || !editName.trim()}
              onClick={() => updateStore.mutate()}
            >
              {updateStore.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'NV'
  );
}
