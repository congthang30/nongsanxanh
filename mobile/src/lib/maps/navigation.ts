import { Linking, Platform } from 'react-native';

/**
 * Mo navigation ngoai (Google Maps / Apple Maps) de chi duong.
 * MVP khong tu code turn-by-turn.
 *
 * Android: Google Maps.
 * iOS: uu tien Google Maps neu cai dat, fallback Apple Maps.
 */
export async function openExternalNavigation(
  lat: number,
  lng: number,
  label?: string,
): Promise<boolean> {
  const dest = `${lat},${lng}`;

  if (Platform.OS === 'ios') {
    const googleUrl = `comgooglemaps://?daddr=${dest}&directionsmode=driving`;
    const canGoogle = await Linking.canOpenURL(googleUrl).catch(() => false);
    if (canGoogle) {
      await Linking.openURL(googleUrl);
      return true;
    }
    const q = label ? `&q=${encodeURIComponent(label)}` : '';
    const appleUrl = `http://maps.apple.com/?daddr=${dest}&dirflg=d${q}`;
    await Linking.openURL(appleUrl);
    return true;
  }

  // Android (va web fallback): Google Maps universal URL
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) {
    await Linking.openURL(url);
    return true;
  }
  return false;
}

/** Goi dien thoai qua tel: link. */
export async function callPhone(phone?: string | null): Promise<boolean> {
  if (!phone) return false;
  const cleaned = phone.replace(/[^+\d]/g, '');
  const url = `tel:${cleaned}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (!can) return false;
  await Linking.openURL(url);
  return true;
}
