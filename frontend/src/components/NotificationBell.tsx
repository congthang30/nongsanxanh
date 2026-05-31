import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { BellIcon } from './icons';
import './notification-bell.css';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 45000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.data.count ?? 0);
    } catch {
      /* im lang */
    }
  };

  const loadList = async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.data as Notification[]);
    } catch {
      /* im lang */
    }
  };

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Dong panel khi click ra ngoai
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await loadList();
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch {
      /* im lang */
    }
  };

  const openItem = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setUnread((u) => Math.max(0, u - 1));
        setItems((prev) =>
          prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date().toISOString() } : it)),
        );
      } catch {
        /* im lang */
      }
    }
    const orderId = n.data?.orderId as string | undefined;
    const ticketId = n.data?.ticketId as string | undefined;
    setOpen(false);
    if (orderId) navigate(`/orders/${orderId}`);
    else if (ticketId) navigate(`/support/tickets/${ticketId}`);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    return `${Math.floor(h / 24)} ngày trước`;
  };

  return (
    <div className="notif-wrap" ref={panelRef}>
      <button
        className="notif-bell"
        onClick={toggle}
        aria-label="Thông báo"
        id="notif-bell-btn"
      >
        <BellIcon />
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel fade-up">
          <div className="notif-head">
            <strong>Thông báo</strong>
            {unread > 0 && (
              <button className="notif-readall" onClick={markAllRead}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 && (
              <div className="notif-empty">Chưa có thông báo nào</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                className={`notif-item ${n.readAt ? '' : 'unread'}`}
                onClick={() => openItem(n)}
              >
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-body">{n.body}</div>
                <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
