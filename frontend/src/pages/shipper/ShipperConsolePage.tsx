import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd, DELIVERY_STATUS_LABEL } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface Job {
  id: string; status: string; codAmount: number | null; codCollected: boolean;
  dropoffName: string | null; dropoffPhone: string | null; dropoffAddress: string | null;
  dropoffLat: number | null; dropoffLng: number | null;
  distanceKm: number | null; failureReason: string | null;
  order: {
    orderNumber: string; grandTotal: number; paymentMethod: string; status: string;
    items: { productNameSnapshot: string; quantity: string; unitSnapshot: string }[];
  };
  store: { name: string; phone: string | null; formattedAddress: string | null };
}

const NEXT_ACTION: Record<string, { label: string; path: string }[]> = {
  ASSIGNED: [{ label: 'Đã lấy hàng', path: 'picked-from-store' }],
  PICKED_FROM_STORE: [{ label: 'Bắt đầu giao', path: 'out-for-delivery' }],
  OUT_FOR_DELIVERY: [
    { label: 'Đã đến nơi', path: 'arrived' },
    { label: 'Giao thành công', path: 'delivered' },
  ],
  ARRIVED_AT_CUSTOMER: [{ label: 'Giao thành công', path: 'delivered' }],
};

export default function ShipperConsolePage({ scope }: { scope: 'active' | 'history' }) {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [failModal, setFailModal] = useState<Job | null>(null);
  const [codModal, setCodModal] = useState<Job | null>(null);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['shipper-jobs', scope],
    queryFn: () => api.get('/shipper/jobs', { params: { scope } }).then((r) => r.data.data as Job[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/shipper/jobs/${id}/${path}`, body ?? {}),
    onSuccess: () => { push('Đã cập nhật'); qc.invalidateQueries({ queryKey: ['shipper-jobs'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  // F-16: mo Google Maps directions
  const openMaps = (j: Job) => {
    const dest =
      j.dropoffLat != null && j.dropoffLng != null
        ? `${j.dropoffLat},${j.dropoffLng}`
        : encodeURIComponent(j.dropoffAddress ?? '');
    if (!dest) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const onDeliver = (j: Job) => {
    if (j.order.paymentMethod === 'COD' && j.codAmount) {
      setCodModal(j);
    } else {
      act.mutate({ id: j.id, path: 'delivered', body: { codCollected: false } });
    }
  };

  return (
    <>
      <PageHeader
        title={scope === 'active' ? 'Đơn đang giao' : 'Lịch sử giao hàng'}
        subtitle={scope === 'active' ? 'Cập nhật trạng thái từng đơn' : 'Đơn đã hoàn tất / thất bại'}
      />
      <div className="stack gap">
        {(jobs ?? []).map((j) => (
          <div key={j.id} className="dash-table-card" style={{ padding: 18 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <strong>#{j.order.orderNumber}</strong>
              <StatusBadge status={j.status} />
            </div>
            <div className="ship-job-grid">
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Lấy hàng tại</div>
                <strong>{j.store.name}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{j.store.formattedAddress}</div>
              </div>
              <div>
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Giao đến</div>
                    <strong>{j.dropoffName}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>{j.dropoffPhone}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{j.dropoffAddress}</div>
                  </div>
                  <button
                    type="button"
                    className="dash-btn dash-btn-sm"
                    onClick={() => openMaps(j)}
                    aria-label="Mở chỉ đường trên Google Maps"
                    title="Mở chỉ đường"
                  >
                    Chỉ đường
                  </button>
                </div>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 13, margin: '8px 0' }}>
              {j.order.items.map((i) => `${i.productNameSnapshot} x${Number(i.quantity)}`).join(', ')}
            </div>
            <div className="between">
              <span>
                {j.distanceKm != null && <span className="muted">{j.distanceKm.toFixed(1)} km · </span>}
                <strong>{formatVnd(j.order.grandTotal)}</strong>
                {j.order.paymentMethod === 'COD' && <span className="badge badge-amber" style={{ marginLeft: 8 }}>COD {formatVnd(j.codAmount ?? 0)}</span>}
              </span>
              {scope === 'active' && (
                <div className="dash-row-actions">
                  {(NEXT_ACTION[j.status] ?? []).map((a) =>
                    a.path === 'delivered' ? (
                      <button key={a.path} className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => onDeliver(j)}>{a.label}</button>
                    ) : (
                      <button key={a.path} className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: j.id, path: a.path })}>{a.label}</button>
                    ),
                  )}
                  {['OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER'].includes(j.status) && (
                    <button className="dash-btn dash-btn-sm" disabled={act.isPending} onClick={() => setFailModal(j)}>Giao thất bại</button>
                  )}
                </div>
              )}
              {scope === 'history' && j.failureReason && (
                <span style={{ color: '#dc2626', fontSize: 13 }}>{j.failureReason}</span>
              )}
            </div>
          </div>
        ))}
        {!isLoading && (jobs ?? []).length === 0 && (
          <div className="dash-table-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            {scope === 'active' ? 'Không có đơn cần giao.' : 'Chưa có lịch sử giao hàng.'}
          </div>
        )}
      </div>

      {/* F-15: Modal nhap ly do that bai */}
      {failModal && (
        <FailReasonModal
          job={failModal}
          busy={act.isPending}
          onClose={() => setFailModal(null)}
          onConfirm={(reason) => {
            act.mutate({ id: failModal.id, path: 'failed', body: { reason } });
            setFailModal(null);
          }}
        />
      )}
      {/* F-15: Modal xac nhan COD */}
      {codModal && (
        <CodConfirmModal
          job={codModal}
          busy={act.isPending}
          onClose={() => setCodModal(null)}
          onConfirm={(collected) => {
            act.mutate({ id: codModal.id, path: 'delivered', body: { codCollected: collected } });
            setCodModal(null);
          }}
        />
      )}
    </>
  );
}

function FailReasonModal({
  job,
  busy,
  onClose,
  onConfirm,
}: {
  job: Job;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Đơn giao thất bại</h2>
        <p className="muted" style={{ marginBottom: 12 }}>#{job.order.orderNumber} · {job.dropoffName}</p>
        <label style={{ display: 'block' }}>
          Lý do (bắt buộc) <span style={{ color: '#dc2626' }}>*</span>
          <textarea
            className="input"
            rows={3}
            autoFocus
            placeholder="VD: Khách không nghe máy, sai địa chỉ, không ai nhận..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button
            className="btn btn-primary"
            disabled={busy || reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
          >
            Xác nhận thất bại
          </button>
        </div>
      </div>
    </div>
  );
}

function CodConfirmModal({
  job,
  busy,
  onClose,
  onConfirm,
}: {
  job: Job;
  busy: boolean;
  onClose: () => void;
  onConfirm: (collected: boolean) => void;
}) {
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Xác nhận giao thành công</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Đơn COD #{job.order.orderNumber} · Khách: <strong>{job.dropoffName}</strong>
        </p>
        <div
          className="card"
          style={{ padding: 14, background: '#fef3c7', borderColor: '#fcd34d', marginBottom: 14 }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>
            Tổng thu COD: <strong style={{ fontSize: 18 }}>{formatVnd(job.codAmount ?? 0)}</strong>
          </p>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onConfirm(false)}>
            Chưa thu được
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => onConfirm(true)}>
            Đã nhận đủ tiền
          </button>
        </div>
      </div>
    </div>
  );
}
