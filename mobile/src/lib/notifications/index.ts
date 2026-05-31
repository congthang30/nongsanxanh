import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push notifications abstraction.
 *
 * ⚠️ TODO(backend): chua co endpoint dang ky push token (da verify - chi co
 * GET /notifications, unread-count, mark-read). Khi backend them
 * `POST /notifications/push-token`, goi `registerPushToken` ben duoi.
 *
 * Deep links (da cau hinh scheme `nongsanxanh` trong app.config.ts):
 *   nongsanxanh://orders/:id
 *   nongsanxanh://shipper/jobs/:id
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Xin quyen notification. Goi sau login/first order, khong phai ngay khi mo app. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return status === 'granted';
}

/** Lay Expo push token (de gui len backend khi endpoint san sang). */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

/**
 * TODO(backend): goi khi backend co `POST /notifications/push-token`.
 * Hien tai chi lay token va log (khong PII).
 */
export async function registerPushToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  // TODO: await apiPost('/notifications/push-token', { token, platform: Platform.OS });
  // Backend chua co endpoint -> chua gui.
}
