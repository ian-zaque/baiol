import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_ID_KEY = 'baiol.guestId';

function randomId() {
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getGuestIdentity() {
  let id = await AsyncStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(GUEST_ID_KEY, id);
  }
  const short = id.replace('guest-', '').slice(0, 4).toUpperCase();
  return {
    guestId: id,
    displayName: `Guest ${short}`,
  };
}
