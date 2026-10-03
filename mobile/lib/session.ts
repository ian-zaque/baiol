import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'baiol.session';

export type AppSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export async function loadSession(): Promise<AppSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: AppSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
