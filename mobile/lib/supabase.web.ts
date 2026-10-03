import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Expo web static render runs in Node, which has no DOM and (on Node 20) no WebSocket. */
const isNodeServer =
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  typeof process.versions?.node === 'string';

const serverStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function nodeWebSocketTransport(): typeof WebSocket {
  // Node 20 has no global WebSocket. `ws` is loaded only for the web server render.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('ws') as typeof WebSocket;
}


export const supabase = createClient(url, anonKey, {
  auth: {
    storage: isNodeServer ? serverStorage : AsyncStorage,
    autoRefreshToken: !isNodeServer,
    persistSession: !isNodeServer,
    detectSessionInUrl: false,
  },
  realtime: typeof WebSocket === 'undefined' ? { transport: nodeWebSocketTransport() } : undefined,
});
