import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useState } from 'react';

/**
 * P1-01: Trang admin duyet/tu choi yeu cau tra hang ONLINE.
 * Duyet -> backend restock + tao Refund PENDING (neu don da thu tien).
 * Tu choi -> dua don ve COMPLETED.
 */
interface ReturnItem {
  id: string;
  quantity: string;
  orderItem: { productNameSnapshot: string; unitPrice: number } | null;
}
interface AdminReturn {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  items: ReturnItem[];
  order: { orderNumber: string; grandTotal: number; storeId: string } | null;
}

export default function AdminReturnsPage() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [confirm, setConfirm] = useState<{ ret: AdminReturn; approve: boolean } | null>(null);

  const { data: returns, isLoading } = useQuery({
    queryKey: ['admin-returns'],
    queryFn: () =>
      api.get('/admin/orders/returns/list').then((r) => r.data.data as AdminReturn[]),
  });

  const process = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/admin/orders/returns/${id}/process`, {
        approve,
        reason: approve ? 'Duyệt trả hàng' : 'Từ chối trả hàng',
      }),
    onSuccess: (r) => {
      const data = r.data.data as { status: string; refundPending?: boolean };
      push(
        data.status === 'RETURNED'
          ? data.refundPending
            ? 'Đã duyệt trả hàng. Đã tạo yêu cầu hoàn tiền (chờ xử lý).'
            : 'Đã duyệt trả hàng và hoàn tồn kho.'
          : 'Đã từ chối yêu cầu trả hàng.',
      );
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['admin-returns'] });
    },
    onError: (e) => { push(getErrorMessage(e), 'error'); setConfirm(null); },
  });

  return (
    <>
      <PageHeader title="Trả hàng online" subtitle="Duyệt yêu cầu trả hàng, hoàn tồn kho và hoàn tiền" />
      <DataTable<AdminReturn>
        rows={returns ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyText="Không có yêu cầu trả hàng"
        columns={[
          {
            key: 'order', title: 'Don', render: (r) => (
              <div>
                <strong>#{r.order?.orderNumber ?? '—'}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleString('vi-VN')}</div>
              </div>
            ),
          },
          {
            key: 'items', title: 'Sản phẩm trả', render: (r) => (
              <span className="muted" style={{ fontSize: 13 }}>
                {r.items.map((i) => `${i.orderItem?.productNameSnapshot ?? '?'}×${Number(i.quantity)}`).join(', ')}
              </span>
            ),
          },
          { key: 'reason', title: 'Lý do', render: (r) => <span className="muted">{r.reason}</span> },
          { key: 'status', title: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act', title: 'Thao tác', render: (r) => (
              r.status === 'REQUESTED' ? (
                <div className="dash-row-actions">
                  <button
                    className="dash-btn dash-btn-sm dash-btn-primary"
                    disabled={process.isPending}
                    onClick={() => setConfirm({ ret: r, approve: true })}
                  >
                    Duyệt
                  </button>
                  <button
                    className="dash-btn dash-btn-sm"
                    disabled={process.isPending}
                    onClick={() => setConfirm({ ret: r, approve: false })}
                  >
                    Từ chối
                  </button>
                </div>
              ) : <span className="muted">—</span>
            ),
          },
        ]}
      />

      <ConfirmModal
        open={!!confirm}
        title={confirm?.approve ? 'Duyệt trả hàng' : 'Từ chối trả hàng'}
        message={
          confirm
            ? confirm.approve
              ? `Duyệt trả hàng cho đơn #${confirm.ret.order?.orderNumber ?? ''}? Hệ thống sẽ hoàn tồn kho và tạo yêu cầu hoàn tiền nếu đã thu tiền.`
              : `Từ chối yêu cầu trả hàng cho đơn #${confirm.ret.order?.orderNumber ?? ''}?`
            : ''
        }
        confirmLabel={confirm?.approve ? 'Duyệt' : 'Từ chối'}
        danger={confirm ? !confirm.approve : false}
        loading={process.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && process.mutate({ id: confirm.ret.id, approve: confirm.approve })}
      />
    </>
  );
}
