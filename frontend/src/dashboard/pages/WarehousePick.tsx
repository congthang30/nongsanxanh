import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';

interface PickOrder {
  id: string; orderNumber: string; status: string; createdAt: string;
  user: { profile: { fullName: string } | null; email: string | null };
  items: { id: string; productNameSnapshot: string; quantity: string; unitSnapshot: string }[];
}

export default function WarehousePick() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  // F-18: state checkbox theo orderId -> Set<itemId>
  const [picked, setPicked] = useState<Record<string, Set<string>>>({});

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

  const { data: orders, isLoading } = useQuery({
    queryKey: ['wh-pick'],
    queryFn: () => api.get('/warehouse/orders-to-pick').then((r) => r.data.data as PickOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => api.post(`/warehouse/orders/${id}/${path}`, {}),
    onSuccess: (_data, vars) => {
      push('Da cap nhat');
      qc.invalidateQueries({ queryKey: ['wh-pick'] });
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
                <button
                  className="dash-btn dash-btn-sm dash-btn-primary"
                  disabled={act.isPending || !allPicked(o)}
                  title={!allPicked(o) ? 'Hay tick day du tat ca san pham truoc' : ''}
                  onClick={() => act.mutate({ id: o.id, path: 'packed' })}
                >
                  Hoan tat dong goi ({(picked[o.id]?.size ?? 0)}/{o.items.length})
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
