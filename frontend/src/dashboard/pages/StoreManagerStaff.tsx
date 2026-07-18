import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, RotateCcw, Search } from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../lib/auth.store';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface StaffRow {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

type RoleFilter = '' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER' | 'STORE_MANAGER';
type StatusFilter = '' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
type SortKey = 'name-asc' | 'name-desc' | 'joined-asc' | 'joined-desc';

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: '', label: 'Mọi vai trò' },
  { value: 'STORE_STAFF', label: 'Bán hàng' },
  { value: 'WAREHOUSE_STAFF', label: 'Kho' },
  { value: 'SHIPPER', label: 'Shipper' },
  { value: 'STORE_MANAGER', label: 'Quản lý' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'ACTIVE', label: 'Đang làm' },
  { value: 'SUSPENDED', label: 'Tạm đình chỉ' },
  { value: 'INACTIVE', label: 'Đã nghỉ' },
];

export default function StoreManagerStaff() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');

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

  const filteredRows = useMemo(() => {
    let rows = [...(data ?? [])];

    // Phòng hờ: ẩn chính tài khoản đang đăng nhập
    if (currentUserId) {
      rows = rows.filter((r) => r.userId !== currentUserId);
    }

    if (roleFilter) {
      rows = rows.filter((r) => r.role === roleFilter);
    }
    if (statusFilter) {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const name = (r.fullName ?? '').toLowerCase();
        const email = (r.email ?? '').toLowerCase();
        const phone = (r.phone ?? '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      });
    }

    const nameOf = (r: StaffRow) => (r.fullName ?? r.email ?? '').toLocaleLowerCase('vi');
    rows.sort((a, b) => {
      if (sortKey === 'name-asc') return nameOf(a).localeCompare(nameOf(b), 'vi');
      if (sortKey === 'name-desc') return nameOf(b).localeCompare(nameOf(a), 'vi');
      if (sortKey === 'joined-asc') {
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      }
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });

    return rows;
  }, [data, currentUserId, roleFilter, statusFilter, search, sortKey]);

  const emptyText = useMemo(() => {
    if (!data?.length) return 'Chưa có nhân viên';
    if (filteredRows.length === 0) return 'Không tìm thấy nhân viên phù hợp bộ lọc';
    return 'Chưa có nhân viên';
  }, [data, filteredRows.length]);

  const hasActiveFilters =
    !!search.trim() || !!roleFilter || !!statusFilter || sortKey !== 'name-asc';

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setSortKey('name-asc');
  };

  return (
    <>
      <PageHeader
        title="Nhân viên cửa hàng"
        subtitle="Danh sách nhân sự làm việc tại cửa hàng (không bao gồm tài khoản của bạn)"
      />

      <section className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <div className="dash-filter-bar" style={{ marginTop: 0 }}>
          <div style={{ position: 'relative', minWidth: 220, flex: '1 1 240px', maxWidth: 360 }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
              }}
            />
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email hoặc SĐT"
              aria-label="Tìm nhân viên"
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>

          <select
            className="input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            aria-label="Lọc theo vai trò"
            style={{ flex: '0 1 11rem', minWidth: '10rem', maxWidth: '14rem' }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all-role'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Lọc theo trạng thái"
            style={{ flex: '0 1 11rem', minWidth: '10rem', maxWidth: '14rem' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all-status'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sắp xếp danh sách"
            style={{ flex: '0 1 13rem', minWidth: '12rem', maxWidth: '16rem' }}
          >
            <option value="name-asc">Tên A → Z</option>
            <option value="name-desc">Tên Z → A</option>
            <option value="joined-asc">Ngày vào cũ → mới</option>
            <option value="joined-desc">Ngày vào mới → cũ</option>
          </select>

          <button
            type="button"
            className="dash-btn dash-btn-sm"
            title={sortKey === 'name-desc' ? 'Đổi sang tên A → Z' : 'Đổi sang tên Z → A'}
            onClick={() => setSortKey((k) => (k === 'name-desc' ? 'name-asc' : 'name-desc'))}
            aria-label="Đảo chiều sắp xếp theo tên"
          >
            {sortKey === 'name-desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
            Tên
          </button>

          <button
            type="button"
            className="dash-btn dash-btn-sm"
            disabled={!hasActiveFilters}
            title="Xóa tất cả bộ lọc"
            onClick={clearFilters}
            aria-label="Xóa tất cả bộ lọc"
          >
            <RotateCcw size={16} />
            Xóa bộ lọc
          </button>
        </div>

        {hasActiveFilters && (
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
            Hiển thị {filteredRows.length}/{data?.length ?? 0} nhân viên
            {search ? ` · tìm “${search.trim()}”` : ''}
            {roleFilter ? ` · ${roleLabel(roleFilter)}` : ''}
            {statusFilter ? ` · ${statusLabel(statusFilter)}` : ''}
            {sortKey !== 'name-asc' ? ` · ${sortLabel(sortKey)}` : ''}
          </p>
        )}
      </section>

      <DataTable<StaffRow>
        rows={filteredRows}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText={emptyText}
        columns={[
          {
            key: 'name',
            title: 'Họ tên',
            render: (r) => <strong style={{ overflowWrap: 'anywhere' }}>{r.fullName ?? r.email}</strong>,
          },
          {
            key: 'email',
            title: 'Email',
            render: (r) => <span style={{ overflowWrap: 'anywhere' }}>{r.email ?? '—'}</span>,
          },
          { key: 'phone', title: 'SĐT', render: (r) => r.phone ?? '—' },
          {
            key: 'role',
            title: 'Vai trò',
            render: (r) => <StatusBadge status={r.role} />,
          },
          {
            key: 'status',
            title: 'Trạng thái',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'joined',
            title: 'Ngày vào',
            render: (r) => (
              <span className="muted">{new Date(r.joinedAt).toLocaleDateString('vi-VN')}</span>
            ),
          },
          {
            key: 'action',
            title: 'Cập nhật',
            render: (r) => {
              const locked = r.role === 'STORE_MANAGER' || r.userId === currentUserId;
              return (
                <select
                  className="input"
                  style={{ minWidth: 140, maxWidth: '100%' }}
                  value={r.status}
                  disabled={locked || updateStatus.isPending}
                  onChange={(e) => updateStatus.mutate({ id: r.id, status: e.target.value })}
                  aria-label={'Cập nhật trạng thái ' + (r.fullName ?? r.email ?? '')}
                  title={locked ? 'Không thể đổi trạng thái quản lý / chính bạn' : undefined}
                >
                  <option value="ACTIVE">Đang làm</option>
                  <option value="SUSPENDED">Tạm đình chỉ</option>
                  <option value="INACTIVE">Đã nghỉ</option>
                </select>
              );
            },
          },
        ]}
      />
    </>
  );
}

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function sortLabel(sort: SortKey) {
  switch (sort) {
    case 'name-desc':
      return 'Tên Z → A';
    case 'joined-asc':
      return 'Ngày vào cũ → mới';
    case 'joined-desc':
      return 'Ngày vào mới → cũ';
    default:
      return 'Tên A → Z';
  }
}
