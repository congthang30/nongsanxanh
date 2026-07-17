import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  UnlockKeyhole,
  UserRoundX,
} from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { ConfirmModal } from '../../components/ConfirmModal';

interface CustomerRow {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  profile: { fullName: string; avatarUrl?: string | null } | null;
  _count: { orders: number };
}

interface StoreLite {
  id: string;
  code: string;
  name: string;
  province?: string;
}

type StaffRole = 'STORE_MANAGER' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER';
type TabKey = 'customers' | 'staff';

interface StaffRow {
  id: string;
  storeId: string;
  userId: string;
  role: StaffRole;
  status: string;
  store: StoreLite;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    status: string;
    profile: { fullName: string; avatarUrl?: string | null } | null;
    roles: string[];
  };
  isStoreManager: boolean;
  isPrimaryShipper: boolean;
}

const STAFF_ROLES: { code: StaffRole; label: string }[] = [
  { code: 'STORE_MANAGER', label: 'Quản lý cửa hàng' },
  { code: 'STORE_STAFF', label: 'Nhân viên bán hàng' },
  { code: 'WAREHOUSE_STAFF', label: 'Nhân viên kho' },
  { code: 'SHIPPER', label: 'Nhân viên giao hàng' },
];

const STAFF_STATUSES = [
  { code: 'ACTIVE', label: 'Đang làm việc' },
  { code: 'INACTIVE', label: 'Đã nghỉ việc' },
  { code: 'SUSPENDED', label: 'Tạm đình chỉ' },
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState<TabKey>('customers');
  const [storeId, setStoreId] = useState(() => localStorage.getItem('adminActiveStoreId') ?? '');
  const [search, setSearch] = useState('');
  const [customerStatus, setCustomerStatus] = useState('');
  const [customerLockTarget, setCustomerLockTarget] = useState<CustomerRow | null>(null);
  const [staffEditing, setStaffEditing] = useState<StaffRow | null>(null);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [removeStaffTarget, setRemoveStaffTarget] = useState<StaffRow | null>(null);

  const storesQuery = useQuery({
    queryKey: ['admin-stores-lite'],
    queryFn: () => api.get('/admin/stores').then((response) => response.data.data as StoreLite[]),
  });

  const customersQuery = useQuery({
    queryKey: ['admin-customers', storeId, customerStatus, search],
    enabled: tab === 'customers',
    queryFn: () =>
      api
        .get('/admin/customers', {
          params: {
            storeId: storeId || undefined,
            status: customerStatus || undefined,
            q: search.trim() || undefined,
          },
        })
        .then((response) => response.data.data as CustomerRow[]),
  });

  const staffQuery = useQuery({
    queryKey: ['admin-staff', storeId],
    enabled: tab === 'staff',
    queryFn: () =>
      api
        .get('/admin/staff', { params: { storeId: storeId || undefined } })
        .then((response) => response.data.data as StaffRow[]),
  });

  const customerStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'LOCKED' }) =>
      api.patch('/admin/customers/' + id + '/status', { status }),
    onSuccess: () => {
      push('Đã cập nhật trạng thái tài khoản khách hàng');
      setCustomerLockTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
    onError: (error) => {
      push(getErrorMessage(error), 'error');
      setCustomerLockTarget(null);
    },
  });

  const removeStaffMutation = useMutation({
    mutationFn: (id: string) => api.delete('/admin/staff/' + id),
    onSuccess: () => {
      push('Đã chuyển nhân viên sang trạng thái nghỉ việc');
      setRemoveStaffTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (error) => {
      push(getErrorMessage(error), 'error');
      setRemoveStaffTarget(null);
    },
  });

  const storeGroups = useMemo(() => {
    const groups = new Map<string, StoreLite[]>();
    for (const store of storesQuery.data ?? []) {
      const key = store.province || 'Khu vực khác';
      groups.set(key, [...(groups.get(key) ?? []), store]);
    }
    return [...groups.entries()];
  }, [storesQuery.data]);

  return (
    <>
      <PageHeader
        title="Quản lý tài khoản"
        subtitle={
          tab === 'customers'
            ? 'Tài khoản khách mua hàng, lịch sử phát sinh và trạng thái truy cập'
            : 'Hồ sơ nhân viên, vai trò vận hành và chi nhánh làm việc'
        }
        actions={
          tab === 'staff' ? (
            <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setCreatingStaff(true)}>
              <Plus size={16} />
              Thêm nhân viên
            </button>
          ) : undefined
        }
      />

      <section className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <div role="tablist" aria-label="Loại tài khoản" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            role="tab"
            aria-selected={tab === 'customers'}
            className={'dash-btn dash-btn-sm ' + (tab === 'customers' ? 'dash-btn-primary' : '')}
            onClick={() => setTab('customers')}
          >
            Tài khoản khách hàng
          </button>
          <button
            role="tab"
            aria-selected={tab === 'staff'}
            className={'dash-btn dash-btn-sm ' + (tab === 'staff' ? 'dash-btn-primary' : '')}
            onClick={() => setTab('staff')}
          >
            Tài khoản nhân viên
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <select
            className="input"
            style={{ maxWidth: 300, height: 38, fontSize: 13 }}
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            aria-label="Lọc theo cụm cửa hàng"
          >
            <option value="">Toàn bộ cụm cửa hàng</option>
            {storeGroups.map(([province, stores]) => (
              <optgroup key={province} label={province}>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} - {store.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {tab === 'customers' && (
            <>
              <div style={{ position: 'relative', minWidth: 240, flex: '1 1 260px', maxWidth: 380 }}>
                <Search
                  size={16}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }}
                />
                <input
                  className="input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên, email hoặc số điện thoại"
                  aria-label="Tìm tài khoản khách hàng"
                  style={{ width: '100%', height: 38, paddingLeft: 36 }}
                />
              </div>
              <select
                className="input"
                value={customerStatus}
                onChange={(event) => setCustomerStatus(event.target.value)}
                aria-label="Lọc trạng thái khách hàng"
                style={{ maxWidth: 180, height: 38, fontSize: 13 }}
              >
                <option value="">Mọi trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đã khóa</option>
              </select>
            </>
          )}
        </div>
      </section>

      {tab === 'customers' ? (
        <CustomerTable
          rows={customersQuery.data ?? []}
          loading={customersQuery.isLoading}
          error={customersQuery.isError ? getErrorMessage(customersQuery.error) : null}
          onRetry={() => customersQuery.refetch()}
          onToggleStatus={setCustomerLockTarget}
        />
      ) : (
        <StaffTable
          rows={staffQuery.data ?? []}
          loading={staffQuery.isLoading}
          error={staffQuery.isError ? getErrorMessage(staffQuery.error) : null}
          onRetry={() => staffQuery.refetch()}
          onEdit={setStaffEditing}
          onRemove={setRemoveStaffTarget}
        />
      )}

      {(creatingStaff || staffEditing) && (
        <StaffModal
          stores={storesQuery.data ?? []}
          staff={staffEditing}
          defaultStoreId={storeId}
          onClose={() => {
            setCreatingStaff(false);
            setStaffEditing(null);
          }}
          onDone={() => {
            setCreatingStaff(false);
            setStaffEditing(null);
            queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
          }}
        />
      )}

      <ConfirmModal
        open={!!customerLockTarget}
        title={customerLockTarget?.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
        message={
          customerLockTarget
            ? (customerLockTarget.status === 'LOCKED' ? 'Mở khóa ' : 'Khóa ') +
              (customerLockTarget.profile?.fullName ?? customerLockTarget.email ?? 'tài khoản này') +
              '?'
            : ''
        }
        confirmLabel={customerLockTarget?.status === 'LOCKED' ? 'Mở khóa' : 'Khóa tài khoản'}
        danger={customerLockTarget?.status !== 'LOCKED'}
        loading={customerStatusMutation.isPending}
        onCancel={() => setCustomerLockTarget(null)}
        onConfirm={() => {
          if (!customerLockTarget) return;
          customerStatusMutation.mutate({
            id: customerLockTarget.id,
            status: customerLockTarget.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED',
          });
        }}
      />

      <ConfirmModal
        open={!!removeStaffTarget}
        title="Xác nhận nhân viên nghỉ việc"
        message={
          removeStaffTarget
            ? 'Ngừng hoạt động hồ sơ của ' +
              (removeStaffTarget.user.profile?.fullName ?? removeStaffTarget.user.email ?? 'nhân viên này') +
              ' tại ' +
              removeStaffTarget.store.name +
              '?'
            : ''
        }
        confirmLabel="Xác nhận nghỉ việc"
        danger
        loading={removeStaffMutation.isPending}
        onCancel={() => setRemoveStaffTarget(null)}
        onConfirm={() => removeStaffTarget && removeStaffMutation.mutate(removeStaffTarget.id)}
      />
    </>
  );
}

function CustomerTable({
  rows,
  loading,
  error,
  onRetry,
  onToggleStatus,
}: {
  rows: CustomerRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onToggleStatus: (row: CustomerRow) => void;
}) {
  return (
    <DataTable<CustomerRow>
      title="Khách hàng"
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      rowKey={(row) => row.id}
      emptyText="Không tìm thấy tài khoản khách hàng phù hợp"
      columns={[
        {
          key: 'identity',
          title: 'Khách hàng',
          render: (row) => (
            <UserIdentity
              name={row.profile?.fullName ?? 'Chưa cập nhật tên'}
              contact={row.email ?? row.phone ?? 'Chưa có thông tin liên hệ'}
              avatarUrl={row.profile?.avatarUrl}
            />
          ),
        },
        { key: 'phone', title: 'Số điện thoại', render: (row) => row.phone || 'Chưa cập nhật' },
        { key: 'orders', title: 'Đơn hàng', align: 'right', render: (row) => row._count.orders },
        { key: 'status', title: 'Trạng thái', render: (row) => <StatusBadge status={row.status} /> },
        {
          key: 'actions',
          title: 'Thao tác',
          render: (row) => (
            <button
              className="dash-btn dash-btn-sm flex items-center gap-2"
              onClick={() => onToggleStatus(row)}
              title={row.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
            >
              {row.status === 'LOCKED' ? <UnlockKeyhole size={15} /> : <LockKeyhole size={15} />}
              {row.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'}
            </button>
          ),
        },
      ]}
    />
  );
}

function StaffTable({
  rows,
  loading,
  error,
  onRetry,
  onEdit,
  onRemove,
}: {
  rows: StaffRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (row: StaffRow) => void;
  onRemove: (row: StaffRow) => void;
}) {
  return (
    <DataTable<StaffRow>
      title="Nhân viên"
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      rowKey={(row) => row.id}
      emptyText="Chưa có nhân viên trong cụm cửa hàng này"
      columns={[
        {
          key: 'identity',
          title: 'Nhân viên',
          render: (row) => (
            <UserIdentity
              name={row.user.profile?.fullName ?? 'Chưa cập nhật tên'}
              contact={row.user.email ?? 'Chưa có email'}
              avatarUrl={row.user.profile?.avatarUrl}
            />
          ),
        },
        { key: 'store', title: 'Chi nhánh', render: (row) => row.store.code + ' - ' + row.store.name },
        { key: 'role', title: 'Vai trò', render: (row) => roleLabel(row.role) },
        { key: 'account', title: 'Tài khoản', render: (row) => <StatusBadge status={row.user.status} /> },
        { key: 'workStatus', title: 'Làm việc', render: (row) => <StatusBadge status={row.status} /> },
        {
          key: 'actions',
          title: 'Thao tác',
          render: (row) => (
            <div className="dash-row-actions">
              <button className="dash-btn dash-btn-sm flex items-center gap-2" onClick={() => onEdit(row)}>
                <Pencil size={15} />
                Sửa hồ sơ
              </button>
              <button
                className="dash-btn dash-btn-sm flex items-center gap-2"
                onClick={() => onRemove(row)}
                disabled={row.status === 'INACTIVE'}
              >
                <UserRoundX size={15} />
                Nghỉ việc
              </button>
            </div>
          ),
        },
      ]}
    />
  );
}

function UserIdentity({
  name,
  contact,
  avatarUrl,
}: {
  name: string;
  contact: string;
  avatarUrl?: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: '#f1f5f9',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          {initials(name)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block' }}>{name}</strong>
        <span className="muted" style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contact}
        </span>
      </div>
    </div>
  );
}

function StaffModal({
  stores,
  staff,
  defaultStoreId,
  onClose,
  onDone,
}: {
  stores: StoreLite[];
  staff: StaffRow | null;
  defaultStoreId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { push } = useToastStore();
  const [form, setForm] = useState({
    storeId: staff?.storeId || defaultStoreId || stores[0]?.id || '',
    fullName: staff?.user.profile?.fullName || '',
    email: staff?.user.email || '',
    phone: staff?.user.phone || '',
    role: (staff?.role || 'STORE_STAFF') as StaffRole,
    status: staff?.status || 'ACTIVE',
    avatarUrl: staff?.user.profile?.avatarUrl || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(form.avatarUrl);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      let avatarUrl = form.avatarUrl || undefined;
      if (avatarFile) {
        const payload = new FormData();
        payload.append('file', avatarFile);
        const upload = await api.post('/admin/media/avatars', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        avatarUrl = upload.data.data.url as string;
      }

      const sharedBody = {
        storeId: form.storeId,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        status: form.status,
        avatarUrl,
      };

      return staff
        ? api.patch('/admin/staff/' + staff.id, sharedBody)
        : api.post('/admin/staff', {
            ...sharedBody,
            email: form.email.trim().toLowerCase(),
          });
    },
    onSuccess: (response) => {
      if (staff) {
        push('Đã cập nhật hồ sơ nhân viên');
      } else if (response.data.data.onboardingEmailSent) {
        push('Đã thêm nhân viên và gửi thông tin đăng nhập qua email');
      } else {
        push('Đã tạo tài khoản nhưng SMTP chưa gửi được email. Kiểm tra cấu hình SMTP.', 'error');
      }
      onDone();
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
  });

  const valid =
    !!form.storeId &&
    !!form.fullName.trim() &&
    (staff ? !!form.email : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email));

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{staff ? 'Cập nhật hồ sơ nhân viên' : 'Thêm nhân viên mới'}</h2>
        <p className="muted" style={{ marginTop: 6, marginBottom: 16, fontSize: 13 }}>
          {staff
            ? 'Admin chỉ cập nhật hồ sơ, vai trò và trạng thái làm việc. Email đăng nhập và mật khẩu do nhân viên quản lý.'
            : 'Hệ thống tự sinh mật khẩu tạm bằng Argon2 và gửi trực tiếp tới email nhân viên.'}
        </p>

        <div className="dash-form-grid">
          <label>
            Ảnh đại diện
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setAvatarFile(file);
                setAvatarPreview(file ? URL.createObjectURL(file) : form.avatarUrl);
              }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Ảnh đại diện nhân viên"
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
              />
            ) : (
              <div
                aria-hidden="true"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                NV
              </div>
            )}
          </div>

          <label>
            Họ và tên
            <input className="input" value={form.fullName} onChange={(event) => set('fullName', event.target.value)} />
          </label>
          <label>
            Email đăng nhập
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              disabled={!!staff}
              title={staff ? 'Email đăng nhập không thể thay đổi bởi Admin' : undefined}
            />
          </label>
          <label>
            Số điện thoại
            <input className="input" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
          </label>
          <label>
            Chi nhánh
            <select className="input" value={form.storeId} onChange={(event) => set('storeId', event.target.value)}>
              <option value="">Chọn chi nhánh</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} - {store.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vai trò vận hành
            <select className="input" value={form.role} onChange={(event) => set('role', event.target.value)}>
              {STAFF_ROLES.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          {staff && (
            <label>
              Trạng thái làm việc
              <select className="input" value={form.status} onChange={(event) => set('status', event.target.value)}>
                {STAFF_STATUSES.map((status) => (
                  <option key={status.code} value={status.code}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex gap-sm" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </button>
          <button
            className="btn btn-primary flex items-center gap-2"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {!staff && <Plus size={16} />}
            {mutation.isPending ? 'Đang lưu...' : staff ? 'Lưu thay đổi' : 'Tạo và gửi email'}
          </button>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  return STAFF_ROLES.find((item) => item.code === role)?.label ?? role;
}

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'NS'
  );
}