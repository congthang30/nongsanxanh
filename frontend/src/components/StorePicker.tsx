import { useEffect, useRef, useState } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { useStoreContext } from '../lib/store.store';
import { useToastStore } from '../lib/toast.store';
import './store-picker.css';

interface Prediction {
  placeId: string;
  description: string;
}

interface Props {
  /** Compact: chi hien 1 dong nut. Full: hien input tim kiem. */
  compact?: boolean;
  onResolved?: () => void;
}

/**
 * Cho phep khach chon khu vuc giao hang -> resolve cua hang phuc vu.
 * Dung tren storefront de gan store context truoc khi mua hang.
 */
export function StorePicker({ compact, onResolved }: Props) {
  const { store, resolveByArea, resolving, lastReason } = useStoreContext();
  const { push } = useToastStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suppressRef.current) { suppressRef.current = false; setSearching(false); return; }
    if (search.trim().length < 2) { setPredictions([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/geo/autocomplete', { params: { input: search } });
        setPredictions(data.data.predictions as Prediction[]);
      } catch {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const pick = async (p: Prediction) => {
    suppressRef.current = true;
    setSearch(p.description);
    setPredictions([]);
    try {
      const { data } = await api.post('/geo/geocode', { placeId: p.placeId, text: p.description });
      const geo = data.data;
      if (!geo) { push('Khong lay duoc toa do', 'error'); return; }
      const parts = splitParts(geo.formattedAddress);
      const result = await resolveByArea({
        lat: geo.lat,
        lng: geo.lng,
        province: parts.province,
        district: parts.district,
        ward: parts.ward,
      });
      if (result.serviceable) {
        push(`Da chon: ${result.selectedStore?.storeName}`);
        setOpen(false);
        onResolved?.();
      } else {
        push(result.message ?? 'Khu vuc nay chua co cua hang phuc vu', 'error');
      }
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  return (
    <div className="store-picker">
      <button
        className={`store-picker-btn ${compact ? 'compact' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sp-pin">📍</span>
        {store ? (
          <span className="sp-label">
            Giao den: <strong>{store.name}</strong>
          </span>
        ) : (
          <span className="sp-label">Chon khu vuc giao hang</span>
        )}
        <span className="sp-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="store-picker-pop">
          <label className="sp-field-label">Nhap khu vuc cua ban</label>
          <div className="sp-autocomplete">
            <input
              className="input"
              placeholder="vd: Le Duan, Quan 1, TP.HCM"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search.trim().length >= 2 && (
              <div className="sp-predictions">
                {searching && <div className="sp-hint">Dang tim...</div>}
                {!searching && predictions.map((p) => (
                  <button key={p.placeId} className="sp-pred" onClick={() => pick(p)}>
                    {p.description}
                  </button>
                ))}
                {!searching && predictions.length === 0 && (
                  <div className="sp-hint">Khong tim thay. Thu nhap chi tiet hon.</div>
                )}
              </div>
            )}
          </div>
          {resolving && <p className="muted sp-hint">Dang tim cua hang phuc vu...</p>}
          {lastReason && lastReason !== 'OK' && !resolving && (
            <p className="sp-warn">Khu vuc nay hien chua duoc phuc vu day du.</p>
          )}
        </div>
      )}
    </div>
  );
}

function splitParts(formatted: string): { province: string; district: string; ward: string } {
  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parts = formatted.split(',').map((s) => s.trim()).filter((p) => {
    if (!p) return false;
    const ascii = strip(p).toLowerCase();
    if (/^viet\s?nam$/.test(ascii) || /^vn$/.test(ascii)) return false;
    if (/^\d{4,7}$/.test(p)) return false;
    return true;
  });
  const n = parts.length;
  return {
    province: parts[n - 1] ?? '',
    district: parts[n - 2] ?? '',
    ward: parts[n - 3] ?? '',
  };
}
