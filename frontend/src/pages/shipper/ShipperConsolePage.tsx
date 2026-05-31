import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd, DELIVERY_STATUS_LABEL } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface Job {
  id: string; status: string; codAmount: number | null; codCollected: boolean;
  dropoffName: string | null; dropoffPhone: string | null; dropoffAddress: string | null;
  distanceKm: number | null; failureReason: string | null;
  order: {
    orderNumber: string; grandTotal: number; paymentMethod: string; status: string;
    items: { productNameSnapshot: string; quantity: string; unitSnapshot: string }[];
  };
  store: { name: string; phone: string | null; formattedAddress: string | null };
}

const NEXT_ACTION: Record<string, { label: string; path: string }[]> = {
  ASSIGNED: [{ label: 'Da lay hang', path: 'picked-from-store' }],
  PICKED_FROM_STORE: [{ label: 'Bat dau giao', path: 'out-for-delivery' }],
  OUT_FOR_DELIVERY: [
    { label: 'Da den noi', path: 'arrived' },
    { label: 'Giao thanh cong', path: 'delivered' },
  ],
  ARRIVED_AT_CUSTOMER: [{ label: 'Giao thanh cong', path: 'delivered' }],
};

export default function ShipperConsolePage({ scope }: { scope: 'active' | 'history' }) {
  const qc = useQueryClient();
  const { push } = useToastStore();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['shipper-jobs', scope],
    queryFn: () => api.get('/shipper/jobs', { params: { scope } }).then((r) => r.data.data as Job[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/shipper/jobs/${id}/${path}`, body ?? {}),
    onSuccess: () => { push('Da cap nhat'); qc.invalidateQueries({ queryKey: ['shipper-jobs'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const fail = (id: string) => {
    const reason = window.prompt('Ly do giao that bai?');
    if (reason) act.mutate({ id, path: 'failed', body: { reason } });
  };

  const deliver = (j: Job) => {
    const cod = j.order.paymentMethod === 'COD' && j.codAmount;
    const collected = cod ? window.confirm(`Da thu COD ${formatVnd(j.codAmount ?? 0)}?`) : false;
    act.mutate({ id: j.id, path: 'delivered', body: { codCollected: collected } });
  };

  return (
    <>
      <PageHeader
        title={scope === 'active' ? 'Don dang giao' : 'Lich su giao hang'}
        subtitle={scope === 'active' ? 'Cap nhat trang thai tung don' : 'Don da hoan tat / that bai'}
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
                <div className="muted" style={{ fontSize: 12 }}>Lay hang tai</div>
                <strong>{j.store.name}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{j.store.formattedAddress}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Giao den</div>
                <strong>{j.dropoffName}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{j.dropoffPhone}</div>
                <div className="muted" style={{ fontSize: 13 }}>{j.dropoffAddress}</div>
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
                      <button key={a.path} className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => deliver(j)}>{a.label}</button>
                    ) : (
                      <button key={a.path} className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: j.id, path: a.path })}>{a.label}</button>
                    ),
                  )}
                  {['OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER'].includes(j.status) && (
                    <button className="dash-btn dash-btn-sm" disabled={act.isPending} onClick={() => fail(j.id)}>Giao that bai</button>
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
            {scope === 'active' ? 'Khong co don can giao.' : 'Chua co lich su giao hang.'}
          </div>
        )}
      </div>
    </>
  );
}
