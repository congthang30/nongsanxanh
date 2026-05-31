import { useToastStore } from '../lib/toast.store';

export function ToastHost() {
  const { toasts } = useToastStore();
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
