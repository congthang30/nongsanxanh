import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Ket qua sau khi nguoi dung chon mot dia chi.
 * Dua qua phan giai (geocode + reverse) tu Nominatim de tach
 * province / district / ward + lat / lng dung de luu store/address.
 */
export interface ResolvedAddress {
  formattedAddress: string;
  province: string;
  district: string | null;
  ward: string | null;
  lat: number;
  lng: number;
}

interface Prediction {
  placeId: string;
  description: string;
}

interface Props {
  value?: ResolvedAddress | null;
  onChange: (addr: ResolvedAddress | null) => void;
  placeholder?: string;
  /** Quoc gia mac dinh = vn (Nominatim countrycodes). */
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Input tim kiem dia chi voi auto-suggest tu OpenStreetMap (Nominatim).
 * - Debounce 300ms.
 * - Sau khi user chon 1 prediction: gi geocode + reverse de lay
 *   province/district/ward + toa do that, callback len parent.
 * - Hien chip de hien thi gia tri da chon, click X de reset.
 */
export function AddressSearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  disabled,
}: Props) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside -> close dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/geo/autocomplete', { params: { input: query } });
        setPredictions(data.data.predictions as Prediction[]);
        setOpen(true);
      } catch {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const pick = async (p: Prediction) => {
    setResolving(true);
    setOpen(false);
    setQuery(p.description);
    try {
      // 1. Geocode -> lat/lng
      const geoRes = await api.post('/geo/geocode', { placeId: p.placeId, text: p.description });
      const geo = geoRes.data.data as
        | { lat: number; lng: number; formattedAddress: string }
        | null;
      if (!geo) {
        onChange(null);
        return;
      }
      // 2. Reverse -> tach province/district/ward
      const revRes = await api.get('/geo/reverse', {
        params: { lat: geo.lat, lng: geo.lng },
      });
      const rev = revRes.data.data as
        | {
            province: string;
            district: string | null;
            ward: string | null;
            formattedAddress: string;
          }
        | null;
      onChange({
        formattedAddress: rev?.formattedAddress ?? geo.formattedAddress,
        province: rev?.province ?? '',
        district: rev?.district ?? null,
        ward: rev?.ward ?? null,
        lat: geo.lat,
        lng: geo.lng,
      });
    } catch {
      onChange(null);
    } finally {
      setResolving(false);
    }
  };

  const reset = () => {
    setQuery('');
    setPredictions([]);
    onChange(null);
  };

  // Hien chip neu da chon
  if (value) {
    return (
      <div className="addr-picked">
        <div className="addr-picked-body">
          <strong>{value.formattedAddress}</strong>
          <div className="addr-picked-meta muted">
            {[value.ward, value.district, value.province].filter(Boolean).join(', ')}
            {' · '}
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          </div>
        </div>
        {!disabled && (
          <button type="button" className="addr-picked-clear" onClick={reset} aria-label="Xóa địa chỉ">
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="addr-search" ref={containerRef}>
      <input
        className="input"
        autoFocus={autoFocus}
        disabled={disabled || resolving}
        placeholder={placeholder ?? 'Nhập địa chỉ (vd: 123 Lê Lợi, Quận 1, TP.HCM)'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
      />
      {(searching || resolving) && (
        <span className="addr-search-spinner">{resolving ? 'Đang phân giải...' : 'Đang tìm...'}</span>
      )}
      {open && predictions.length > 0 && (
        <ul className="addr-search-list">
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button type="button" onClick={() => pick(p)}>
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
