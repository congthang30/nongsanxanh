import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Session id cho gio hang anonymous (guest). Backend doc qua header x-session-id.
 * Khong nhay cam nen luu AsyncStorage la du.
 */
const SESSION_KEY = 'nsx.sessionId';
let cached: string | null = null;

function randomId(): string {
  // Khong can crypto manh cho session cart guest.
  return (
    'sess-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function getSessionId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(SESSION_KEY, id);
  }
  cached = id;
  return id;
}
