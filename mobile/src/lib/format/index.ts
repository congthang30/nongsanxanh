/** Dinh dang tien VND. Backend luu gia dang integer (dong). */
export function formatVnd(amount?: number | null): string {
  if (amount == null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Dinh dang so luong (co the la so thap phan voi don vi kg). */
export function formatQty(qty: number | string): string {
  const n = typeof qty === 'string' ? Number(qty) : qty;
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

export function formatDistanceKm(km?: number | null): string {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
