import { useState, useRef, useEffect } from 'react';
import { api, getSessionId } from '../lib/api';
import './chat-widget.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Xin chào! Mình là trợ lý NongSan Xanh 🌿. Bạn cần tư vấn sản phẩm, chính sách hay tra cứu đơn hàng?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', {
        message: text,
        conversationId,
      }, { headers: { 'X-Session-Id': getSessionId() } });
      const answer = data.data.answer as string;
      setConversationId(data.data.conversationId as string);
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Xin lỗi, hiện chưa kết nối được trợ lý. Bạn thử lại sau nhé.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const QUICK_REPLIES = [
    'Liệt kê các sản phẩm đang có',
    'Bảng giá sản phẩm',
    'Sản phẩm nào còn hàng?',
    'Tra cứu đơn hàng của tôi',
  ];

  return (
    <>
      <button
        className={`chat-fab ${open ? 'chat-fab-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Tro ly AI"
        id="chat-toggle-btn"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="chat-panel fade-up" id="chat-panel">
          <div className="chat-head">
            <div className="chat-head-info">
              <span className="chat-avatar">🌿</span>
              <div>
                <strong>Trợ lý NongSan Xanh</strong>
                <span className="chat-status">● Trực tuyến</span>
              </div>
            </div>
          </div>

          <div className="chat-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-assistant chat-typing">
                <span /> <span /> <span />
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="chat-chips">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  className="chat-chip"
                  onClick={() => send(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Nhập câu hỏi..."
              id="chat-input"
            />
            <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={loading} id="chat-send-btn">
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
