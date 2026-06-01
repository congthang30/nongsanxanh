import { Linking } from 'react-native';

/**
 * Mo navigation ngoai de chi duong - dung OpenStreetMap, KHONG dung Google Maps.
 * MVP khong tu code turn-by-turn.
 *
 * - Uu tien geo: URI -> mo app ban do mac dinh cua may (vd Organic Maps, OsmAnd...).
 * - Fallback: mo openstreetmap.org directions tren trinh duyet.
 */
export async function openExternalNavigation(
  lat: number,
  lng: number,
  _label?: string,
): Promise<boolean> {
  const dest = `${lat},${lng}`;

  // geo: URI duoc cac app ban do (OSM-based) xu ly. CHI dua toa do (khong kem label/ten)
  // vi mot so app hieu sai phan "(ten)" -> mo sai vi tri.
  const geoUrl = `geo:${dest}?q=${dest}`;
  const canGeo = await Linking.canOpenURL(geoUrl).catch(() => false);
  if (canGeo) {
    await Linking.openURL(geoUrl);
    return true;
  }

  // Fallback: OpenStreetMap directions (xe hoi) tren trinh duyet, chi dua toa do.
  const osmUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat}%2C${lng}`;
  const canOsm = await Linking.canOpenURL(osmUrl).catch(() => false);
  if (canOsm) {
    await Linking.openURL(osmUrl);
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
