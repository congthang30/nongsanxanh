import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../../components/ConfirmModal';

interface PickOrder {
  id: string; orderNumber: string; status: string; createdAt: string; updatedAt: string;
  user: { profile: { fullName: string } | null; email: string | null };
  items: { id: string; productNameSnapshot: string; quantity: string; unitSnapshot: string }[];
}

export default function WarehousePick() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  // F-18: state checkbox theo orderId -> Set<itemId>
  const [picked, setPicked] = useState<Record<string, Set<string>>>({});
  const [shortageTarget, setShortageTarget] = useState<PickOrder | null>(null);
  const [tab, setTab] = useState<'ACTIVE' | 'PROCESSED'>('ACTIVE');

  const togglePick = (orderId: string, itemId: string) => {
    setPicked((prev) => {
      const set = new Set(prev[orderId] ?? []);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      return { ...prev, [orderId]: set };
    });
  };

  const allPicked = (o: PickOrder) =>
    o.items.length > 0 && o.items.every((it) => picked[o.id]?.has(it.id));

  const { data: activeOrders, isLoading: activeLoading } = useQuery({
    queryKey: ['wh-pick'],
    queryFn: () => api.get('/warehouse/orders-to-pick').then((r) => r.data.data as PickOrder[]),
  });
  const { data: processedOrders, isLoading: processedLoading } = useQuery({
    queryKey: ['wh-processed'],
    queryFn: () => api.get('/warehouse/orders-processed').then((r) => r.data.data as PickOrder[]),
    enabled: tab === 'PROCESSED',
  });
  const orders = tab === 'ACTIVE' ? activeOrders : processedOrders;
  const isLoading = tab === 'ACTIVE' ? activeLoading : processedLoading;

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/warehouse/orders/${id}/${path}`, body ?? {}),
    onSuccess: (_data, vars) => {
      push(
        vars.path === 'report-shortage'
          ? 'Đã báo thiếu hàng và hủy đơn'
          : vars.path === 'packed'
            ? 'Đã đóng gói và chuyển sang shipper'
            : 'Đã cập nhật',
      );
      setShortageTarget(null);
      qc.invalidateQueries({ queryKey: ['wh-pick'] });
      qc.invalidateQueries({ queryKey: ['wh-processed'] });
      qc.invalidateQueries({ queryKey: ['wh-to-pick'] });
      if (vars.path === 'packed' || vars.path === 'report-shortage') {
        setTab('PROCESSED');
      }
      // reset checkbox cua don nay
      setPicked((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Xác nhận & soạn hàng" subtitle="Kho xác nhận, đóng gói và tự động bàn giao đơn cho shipper" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 6 }}>
        <button
          id="warehouse-active-orders-tab"
          className={`dash-btn dash-btn-sm ${tab === 'ACTIVE' ? 'dash-btn-primary' : ''}`}
          onClick={() => setTab('ACTIVE')}
        >
          Cần xử lý
        </button>
        <button
          id="warehouse-processed-orders-tab"
          className={`dash-btn dash-btn-sm ${tab === 'PROCESSED' ? 'dash-btn-primary' : ''}`}
          onClick={() => setTab('PROCESSED')}
        >
          Lịch sử đã xử lý
        </button>
      </div>
      <div className="stack gap">
        {(orders ?? []).map((o) => (
          <div key={o.id} className="dash-table-card" style={{ padding: 18 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div>
                <strong>#{o.orderNumber}</strong>
                <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
                  {o.user.profile?.fullName ?? o.user.email}
                </span>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <ul className="wh-pick-items">
              {o.items.map((it) => (
                <li key={it.id}>
                  {tab === 'ACTIVE' ? (
                    <label className="flex gap-sm" style={{ alignItems: 'center', cursor: o.status === 'PICKING' ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        checked={picked[o.id]?.has(it.id) ?? false}
                        onChange={() => togglePick(o.id, it.id)}
                        disabled={o.status !== 'PICKING'}
                      />
                      <span>
                        {it.productNameSnapshot}
                        <strong> x{Number(it.quantity)} {it.unitSnapshot}</strong>
                      </span>
                    </label>
                  ) : (
                    <span>
                      {it.productNameSnapshot}
                      <strong> x{Number(it.quantity)} {it.unitSnapshot}</strong>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {tab === 'ACTIVE' && (
              <div className="dash-row-actions" style={{ marginTop: 12 }}>
                {['PLACED', 'STORE_CONFIRMED'].includes(o.status) && (
                  <button
                    id={`warehouse-confirm-${o.id}`}
                    className="dash-btn dash-btn-sm dash-btn-primary"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: o.id, path: 'confirm-and-start-picking' })}
                  >
                    Xác nhận &amp; soạn hàng
                  </button>
                )}
                {['PLACED', 'STORE_CONFIRMED', 'PICKING'].includes(o.status) && (
                  <button
                    id={`warehouse-shortage-${o.id}`}
                    className="dash-btn dash-btn-sm"
                    disabled={act.isPending}
                    onClick={() => setShortageTarget(o)}
                  >
                    Báo thiếu hàng
                  </button>
                )}
                {o.status === 'PICKING' && (
                  <button
                    id={`warehouse-packed-${o.id}`}
                    className="dash-btn dash-btn-sm dash-btn-primary"
                    disabled={act.isPending || !allPicked(o)}
                    title={!allPicked(o) ? 'Hãy tick đầy đủ tất cả sản phẩm trước' : ''}
                    onClick={() => act.mutate({ id: o.id, path: 'packed' })}
                  >
                    Hoàn tất đóng gói &amp; giao shipper ({(picked[o.id]?.size ?? 0)}/{o.items.length})
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {!isLoading && (orders ?? []).length === 0 && (
          <div className="dash-table-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            {tab === 'ACTIVE'
              ? 'Không có đơn chờ xác nhận hoặc cần soạn.'
              : 'Chưa có lịch sử đơn hàng được kho xử lý.'}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!shortageTarget}
        title="Báo thiếu hàng"
        message={shortageTarget ? `Đơn #${shortageTarget.orderNumber} sẽ bị hủy và phần tồn đã giữ sẽ được hoàn lại. Nếu khách đã thanh toán, hệ thống sẽ tạo yêu cầu hoàn tiền.` : ''}
        confirmLabel="Xác nhận thiếu hàng"
        danger
        loading={act.isPending}
        requireReason
        minReasonLength={3}
        reasonLabel="Sản phẩm và số lượng bị thiếu"
        reasonPlaceholder="Ví dụ: Thiếu 2 kg cà chua so với tồn kho hệ thống"
        onCancel={() => setShortageTarget(null)}
        onConfirm={(reason) => shortageTarget && act.mutate({
          id: shortageTarget.id,
          path: 'report-shortage',
          body: { reason },
        })}
      />
    </>
  );
}
