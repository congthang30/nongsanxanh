import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface PickOrder {
  id: string; orderNumber: string; status: string; createdAt: string;
  user: { profile: { fullName: string } | null; email: string | null };
  items: { id: string; productNameSnapshot: string; quantity: string; unitSnapshot: string }[];
}

export default function WarehousePick() {
  const qc = useQueryClient();
  const { push } = useToastStore();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['wh-pick'],
    queryFn: () => api.get('/warehouse/orders-to-pick').then((r) => r.data.data as PickOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => api.post(`/warehouse/orders/${id}/${path}`, {}),
    onSuccess: () => { push('Da cap nhat'); qc.invalidateQueries({ queryKey: ['wh-pick'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Soan hang" subtitle="Don da xac nhan can soan va dong goi" />
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
                  <input type="checkbox" /> {it.productNameSnapshot}
                  <strong> x{Number(it.quantity)} {it.unitSnapshot}</strong>
                </li>
              ))}
            </ul>
            <div className="dash-row-actions" style={{ marginTop: 12 }}>
              {o.status === 'STORE_CONFIRMED' && (
                <button className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'start-picking' })}>
                  Bat dau soan
                </button>
              )}
              {o.status === 'PICKING' && (
                <button className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'packed' })}>
                  Hoan tat dong goi
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && (orders ?? []).length === 0 && (
          <div className="dash-table-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            Khong co don can soan.
          </div>
        )}
      </div>
    </>
  );
}
