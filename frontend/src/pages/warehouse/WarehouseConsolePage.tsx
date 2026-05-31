import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import '../console.css';

interface InvRow {
  id: string; quantityOnHand: string; quantityReserved: string;
  warehouse: { name: string };
  batch?: { batchCode: string; expiryDate?: string; qualityGrade?: string; status: string };
  variant: { sku: string; unit: string; product: { name: string } };
}
interface PackOrder {
  id: string; orderNumber: string; status: string;
  items: { productNameSnapshot: string; quantityOrdered: string }[];
  address?: { recipientName: string; fullAddress: string };
}

export default function WarehouseConsolePage() {
  const [tab, setTab] = useState<'inventory' | 'pack' | 'expiring'>('inventory');
  const qc = useQueryClient();
  const toast = useToastStore();

  const invQ = useQuery({
    queryKey: ['wh-inventory'],
    queryFn: () => api.get('/warehouse/inventory').then((r) => r.data.data as InvRow[]),
    enabled: tab === 'inventory',
  });
  const packQ = useQuery({
    queryKey: ['wh-pack'],
    queryFn: () => api.get('/warehouse/orders-to-pack').then((r) => r.data.data as PackOrder[]),
    enabled: tab === 'pack',
  });
  const expQ = useQuery({
    queryKey: ['wh-expiring'],
    queryFn: () => api.get('/warehouse/expiring').then((r) => r.data.data as { id: string; batchCode: string; expiryDate: string; variant: { product: { name: string } } }[]),
    enabled: tab === 'expiring',
  });

  const adjust = useMutation({
    mutationFn: (b: { inventoryId: string; type: string; quantity: number }) => api.post('/warehouse/stock/adjust', b),
    onSuccess: () => { toast.push('Đã điều chỉnh tồn', 'success'); qc.invalidateQueries({ queryKey: ['wh-inventory'] }); },
    onError: (e) => toast.push(getErrorMessage(e), 'error'),
  });
  const advanceStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => { toast.push('Đã cập nhật đơn', 'success'); qc.invalidateQueries({ queryKey: ['wh-pack'] }); },
    onError: (e) => toast.push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="container section">
      <div className="console-head">
        <h1>Kho hàng</h1>
        <p className="muted">Quản lý tồn kho, soạn hàng và kiểm soát hạn dùng</p>
      </div>

      <div className="console-tabs">
        {([['inventory', 'Tồn kho'], ['pack', 'Soạn hàng'], ['expiring', 'Sắp hết hạn']] as const).map(([k, l]) => (
          <button key={k} className={`console-tab ${tab === k ? 'console-tab-active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'inventory' && (
        <table className="data-table">
          <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Lô</th><th>Tồn</th><th>Giữ</th><th></th></tr></thead>
          <tbody>
            {invQ.data?.map((r) => (
              <tr key={r.id}>
                <td>{r.variant.product.name}</td>
                <td>{r.variant.sku}</td>
                <td>{r.batch?.batchCode ?? '—'}</td>
                <td>{Number(r.quantityOnHand)} {r.variant.unit}</td>
                <td>{Number(r.quantityReserved)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => adjust.mutate({ inventoryId: r.id, type: 'IN', quantity: 10 })}>+10</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => adjust.mutate({ inventoryId: r.id, type: 'OUT', quantity: 10 })}>-10</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'pack' && (
        packQ.data && packQ.data.length > 0 ? (
          <div className="console-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {packQ.data.map((o) => (
              <div key={o.id} className="card" style={{ padding: 18 }}>
                <div className="between"><strong>#{o.orderNumber}</strong><span className="pill pill-amber">{o.status}</span></div>
                <p className="muted" style={{ fontSize: 13, margin: '8px 0' }}>{o.address?.recipientName} · {o.address?.fullAddress}</p>
                <ul style={{ fontSize: 13, paddingLeft: 18, margin: '8px 0' }}>
                  {o.items.map((it, i) => <li key={i}>{it.productNameSnapshot} × {Number(it.quantityOrdered)}</li>)}
                </ul>
                <button className="btn btn-primary btn-sm" onClick={() => advanceStatus.mutate({ id: o.id, status: o.status === 'CONFIRMED' ? 'PACKING' : 'READY_TO_SHIP' })}>
                  {o.status === 'CONFIRMED' ? 'Bắt đầu soạn' : 'Sẵn sàng giao'}
                </button>
              </div>
            ))}
          </div>
        ) : <div className="empty-state"><span className="empty-state-icon">📦</span>Không có đơn cần soạn</div>
      )}

      {tab === 'expiring' && (
        expQ.data && expQ.data.length > 0 ? (
          <table className="data-table">
            <thead><tr><th>Sản phẩm</th><th>Lô</th><th>Hạn dùng</th></tr></thead>
            <tbody>
              {expQ.data.map((b) => (
                <tr key={b.id}><td>{b.variant.product.name}</td><td>{b.batchCode}</td><td><span className="pill pill-red">{new Date(b.expiryDate).toLocaleDateString('vi-VN')}</span></td></tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty-state"><span className="empty-state-icon">✅</span>Không có lô sắp hết hạn</div>
      )}
    </div>
  );
}
