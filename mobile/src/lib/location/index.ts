import * as Location from 'expo-location';

export type LocationPermissionState = 'granted' | 'denied' | 'undetermined';

export interface Coords {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

/** Xin quyen foreground location. Khong block neu bi tu choi (co fallback nhap tay). */
export async function requestForegroundPermission(): Promise<LocationPermissionState> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export async function getForegroundPermission(): Promise<LocationPermissionState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

/** Lay vi tri hien tai. Tra null neu khong co quyen hoac loi. */
export async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const perm = await getForegroundPermission();
    if (perm !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
    };
  } catch {
    return null;
  }
}

/**
 * Foreground watcher cho shipper (interval ~15-30s). Tra ham huy.
 * Khong lam background tracking trong MVP.
 */
export async function watchPosition(
  onChange: (c: Coords) => void,
  intervalMs = 20000,
): Promise<() => void> {
  const perm = await getForegroundPermission();
  if (perm !== 'granted') return () => {};
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervalMs,
      distanceInterval: 25,
    },
    (pos) => {
      onChange({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      });
    },
  );
  return () => sub.remove();
}
