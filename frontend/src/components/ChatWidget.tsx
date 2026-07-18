import { useState, useRef, useEffect } from 'react';
import { Bot, Circle, MessageCircle, Send, X } from 'lucide-react';
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
      content:
        'Xin chào! Mình là trợ lý Nông Sản Xanh. Bạn cần tư vấn sản phẩm, chính sách hay tra cứu đơn hàng?',
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
      const { data } = await api.post(
        '/ai/chat',
        {
          message: text,
          conversationId,
        },
        { headers: { 'X-Session-Id': getSessionId() } },
      );
      const answer = data.data.answer as string;
      setConversationId(data.data.conversationId as string);
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Xin lỗi, hiện chưa kết nối được trợ lý. Bạn thử lại sau nhé.',
        },
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
        type="button"
        className={`chat-fab ${open ? 'chat-fab-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        id="chat-toggle-btn"
      >
        {open ? <X size={26} strokeWidth={2.25} aria-hidden /> : <MessageCircle size={26} strokeWidth={2.25} aria-hidden />}
      </button>

      {open && (
        <div className="chat-panel fade-up" id="chat-panel">
          <div className="chat-head">
            <div className="chat-head-info">
              <span className="chat-avatar" aria-hidden>
                <Bot size={22} strokeWidth={2} />
              </span>
              <div>
                <strong>Trợ lý NongSan Xanh</strong>
                <span className="chat-status">
                  <Circle size={8} fill="currentColor" strokeWidth={0} aria-hidden />
                  Trực tuyến
                </span>
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
              <div className="chat-msg chat-msg-assistant chat-typing" aria-label="Đang trả lời">
                <span /> <span /> <span />
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="chat-chips">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  type="button"
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
              aria-label="Nhập câu hỏi cho trợ lý"
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              id="chat-send-btn"
              aria-label="Gửi tin nhắn"
            >
              <Send size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
