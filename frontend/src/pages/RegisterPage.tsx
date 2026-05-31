import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { useAuthStore, AuthUser } from '../lib/auth.store';
import { useToastStore } from '../lib/toast.store';
import './auth.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuthStore();
  const { push } = useToastStore();
  const navigate = useNavigate();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setSession(data.data as { accessToken: string; refreshToken: string; user: AuthUser });
      push('Đăng ký thành công! Chào mừng bạn.');
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div className="auth-art-emoji">🥗</div>
        <h2>Tham gia NongSan Xanh</h2>
        <p>Tạo tài khoản để mua nông sản tươi sạch, tích điểm và nhận ưu đãi độc quyền theo mùa.</p>
        <div className="auth-art-points">
          <div>✓ Ưu đãi cho thành viên mới</div>
          <div>✓ Lưu địa chỉ & đặt lại nhanh</div>
          <div>✓ Theo dõi đơn realtime</div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="card auth-card" style={{ padding: 36 }}>
          <h1>Tạo tài khoản</h1>
          <p className="muted auth-sub">Chỉ mất chưa đến một phút</p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Họ và tên</label>
              <input className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div className="field">
              <label>Số điện thoại</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Đang tạo...' : 'Đăng ký'}
            </button>
          </form>
          <p className="auth-switch">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
