import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { useAuthStore, AuthUser } from '../lib/auth.store';
import { useCartStore } from '../lib/cart.store';
import { useToastStore } from '../lib/toast.store';
import './auth.css';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface GoogleConfigResponse {
  clientId?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
          cancel?: () => void;
        };
      };
    };
  }
}

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`,
  );

  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script');

    function cleanup() {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    }
    function handleLoad() {
      cleanup();
      resolve();
    }
    function handleError() {
      cleanup();
      reject(new Error('Google Identity script failed to load'));
    }

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existing) {
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export default function LoginPage() {
  const [email, setEmail] = useState('customer@nsx.local');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const { setSession } = useAuthStore();
  const { fetch: fetchCart } = useCartStore();
  const { push } = useToastStore();
  const navigate = useNavigate();

  const completeLogin = useCallback(
    async (payload: LoginResponse) => {
      setSession(payload);
      await fetchCart().catch(() => {});
      push(`Chào mừng ${payload.user.fullName ?? payload.user.email}!`);
      const roles = payload.user.roles;
      if (roles.some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r))) {
        navigate('/admin');
      } else if (roles.includes('STORE_MANAGER')) {
        navigate('/store-manager');
      } else if (roles.includes('WAREHOUSE_STAFF')) {
        navigate('/warehouse');
      } else if (roles.includes('STORE_STAFF')) {
        navigate('/store');
      } else if (roles.includes('SHIPPER')) {
        navigate('/shipper');
      } else if (roles.includes('SUPPORT')) {
        navigate('/staff');
      } else {
        navigate('/');
      }
    },
    [fetchCart, navigate, push, setSession],
  );

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setError('Google không trả về thông tin đăng nhập');
        return;
      }

      setError('');
      setGoogleLoading(true);
      try {
        const { data } = await api.post('/auth/google', {
          credential: response.credential,
        });
        await completeLogin(data.data as LoginResponse);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeLogin],
  );

  useEffect(() => {
    let cancelled = false;

    const setupGoogleLogin = async () => {
      try {
        const { data } = await api.get('/auth/google/config');
        const { clientId } = data.data as GoogleConfigResponse;
        if (!clientId || cancelled) return;

        await loadGoogleIdentityScript();
        if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          width: Math.min(348, googleButtonRef.current.clientWidth || 348),
        });
        setGoogleReady(true);
      } catch {
        if (!cancelled) setGoogleReady(false);
      }
    };

    setupGoogleLogin();

    return () => {
      cancelled = true;
      window.google?.accounts?.id.cancel?.();
    };
  }, [handleGoogleCredential]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const payload = data.data as LoginResponse;
      await completeLogin(payload);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div className="auth-art-emoji">NSX</div>
        <h2>Chào mừng trở lại!</h2>
        <p>Đăng nhập để tiếp tục mua sắm nông sản tươi sạch, theo dõi đơn hàng và nhận ưu đãi.</p>
        <div className="auth-art-points">
          <div>Cửa hàng khu vực gần bạn</div>
          <div>Giao nhanh trong ngày</div>
          <div>Thanh toán COD &amp; VNPay</div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="card auth-card" style={{ padding: 36 }}>
          <h1>Đăng nhập</h1>
          <p className="muted auth-sub">Nhập thông tin tài khoản của bạn</p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
          {(googleReady || googleLoading) && (
            <div className="auth-divider">
              <span>hoặc</span>
            </div>
          )}
          <div
            ref={googleButtonRef}
            className={`google-login-slot${googleReady ? ' is-ready' : ''}`}
          />
          {googleLoading && <p className="auth-google-loading">Đang đăng nhập Google...</p>}
          <p className="auth-switch">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </p>
          <div className="auth-demo">
            <strong>Tài khoản demo:</strong><br />
            Khách: <code>customer@nsx.local</code><br />
            Admin: <code>admin@nsx.local</code><br />
            Quản lý CH: <code>manager.q1@nsx.local</code><br />
            NV bán hàng: <code>staff.q1.a@nsx.local</code><br />
            NV kho: <code>kho.q1.a@nsx.local</code><br />
            Shipper: <code>shipper.q1@nsx.local</code><br />
            Mật khẩu: <code>Password123!</code>
          </div>
        </div>
      </div>
    </div>
  );
}
