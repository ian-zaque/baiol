import { io, Socket } from 'socket.io-client';
import { api } from './api';

export function connectRealtime(auth: {
  token?: string;
  shareToken?: string;
  guestId?: string;
  displayName?: string;
}): Socket {
  return io(api.url, {
    auth,
    autoConnect: false,
  });
}
