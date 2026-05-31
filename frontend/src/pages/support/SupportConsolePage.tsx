import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import '../console.css';

interface Ticket {
  id: string; code: string; subject: string; status: string; priority: string;
  createdAt: string;
  user?: { email: string; profile?: { fullName: string } };
  order?: { orderNumber: string };
}
interface TicketDetail extends Ticket {
  messages: { id: string; senderRole: string; body: string; createdAt: string }[];
}

const STATUS_PILL: Record<string, string> = {
  OPEN: 'pill-amber', ANSWERED: 'pill-blue', RESOLVED: 'pill-green', CLOSED: 'pill-slate',
};

export default function SupportConsolePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const qc = useQueryClient();
  const toast = useToastStore();

  const listQ = useQuery({
    queryKey: ['support-tickets-admin'],
    queryFn: () => api.get('/admin/support/tickets').then((r) => r.data.data as Ticket[]),
  });
  const detailQ = useQuery({
    queryKey: ['support-ticket', selected],
    queryFn: () => api.get(`/support/tickets/${selected}`).then((r) => r.data.data as TicketDetail),
    enabled: !!selected,
  });

  const sendReply = useMutation({
    mutationFn: () => api.post(`/support/tickets/${selected}/reply`, { message: reply }),
    onSuccess: () => { setReply(''); detailQ.refetch(); qc.invalidateQueries({ queryKey: ['support-tickets-admin'] }); },
    onError: (e) => toast.push(getErrorMessage(e), 'error'),
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/admin/support/tickets/${selected}/status`, { status }),
    onSuccess: () => { toast.push('Đã cập nhật', 'success'); qc.invalidateQueries({ queryKey: ['support-tickets-admin'] }); },
    onError: (e) => toast.push(getErrorMessage(e), 'error'),
  });

  return (
    <div className="container section">
      <div className="console-head">
        <h1>Hỗ trợ khách hàng</h1>
        <p className="muted">Tiếp nhận và xử lý yêu cầu hỗ trợ</p>
      </div>

      <div className="support-layout">
        <div className="support-list">
          {listQ.data?.length ? listQ.data.map((t) => (
            <button key={t.id} className={`support-item ${selected === t.id ? 'support-item-active' : ''}`} onClick={() => setSelected(t.id)}>
              <div className="between"><strong>{t.code}</strong><span className={`pill ${STATUS_PILL[t.status] ?? 'pill-slate'}`}>{t.status}</span></div>
              <div className="support-subject">{t.subject}</div>
              <div className="muted" style={{ fontSize: 12 }}>{t.user?.profile?.fullName ?? t.user?.email}</div>
            </button>
          )) : <div className="empty-state"><span className="empty-state-icon">🎫</span>Chưa có ticket</div>}
        </div>

        <div className="support-detail">
          {detailQ.data ? (
            <>
              <div className="between" style={{ marginBottom: 12 }}>
                <div><h3 style={{ margin: 0 }}>{detailQ.data.subject}</h3><span className="muted">{detailQ.data.code}</span></div>
                <select value={detailQ.data.status} onChange={(e) => setStatus.mutate(e.target.value)} className="status-select">
                  {['OPEN', 'ANSWERED', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="support-thread">
                {detailQ.data.messages.map((m) => (
                  <div key={m.id} className={`support-bubble ${m.senderRole === 'SUPPORT' ? 'support-bubble-staff' : 'support-bubble-customer'}`}>
                    <div className="support-bubble-role">{m.senderRole === 'SUPPORT' ? 'Hỗ trợ' : 'Khách'}</div>
                    {m.body}
                  </div>
                ))}
              </div>
              <div className="chat-input-row" style={{ border: 'none', padding: 0, marginTop: 12 }}>
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Nhập phản hồi..."
                  onKeyDown={(e) => e.key === 'Enter' && reply.trim() && sendReply.mutate()} />
                <button className="btn btn-primary btn-sm" onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>Gửi</button>
              </div>
            </>
          ) : <div className="empty-state"><span className="empty-state-icon">💬</span>Chọn một ticket để xem</div>}
        </div>
      </div>
    </div>
  );
}
