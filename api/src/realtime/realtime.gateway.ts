import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { extractBearerToken } from '../common/extract-bearer';
import { displayNameOf } from '../common/types';
import { ListsService } from '../lists/lists.service';
import { SupabaseService } from '../supabase/supabase.service';
import { type ListRealtimeEvent, REALTIME_EVENTS } from './realtime.events';

type PresenceUser = {
  id: string;
  email: string;
  display_name: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly presence = new Map<string, Map<string, PresenceUser>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly lists: ListsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const header = client.handshake.headers.authorization;
      const authToken =
        typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : undefined;
      const token = extractBearerToken(
        Array.isArray(header) ? header[0] : header,
        authToken,
      );
      if (!token) {
        client.disconnect();
        return;
      }
      const user = await this.supabase.getUserFromToken(token);
      const profile = await this.lists.ensureProfile(user);
      client.data.user = {
        id: user.id,
        email: user.email,
        display_name: displayNameOf(profile),
      } satisfies PresenceUser;
    } catch (error) {
      this.logger.warn(`Socket rejected: ${(error as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const room of this.roomsFor(client)) {
      this.leaveRoom(client, room);
    }
  }

  @SubscribeMessage('join_list')
  async joinList(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { listId?: string },
  ) {
    const user = this.socketUser(client);
    const listId = body?.listId;
    if (!user || !listId) {
      return { ok: false };
    }
    await this.lists.assertMember(listId, user.id);
    await client.join(this.roomName(listId));
    this.addPresence(listId, client.id, user);
    this.emitPresence(listId);
    return { ok: true };
  }

  @SubscribeMessage('leave_list')
  leaveList(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { listId?: string },
  ) {
    const listId = body?.listId;
    if (!listId) {
      return { ok: false };
    }
    this.leaveRoom(client, listId);
    return { ok: true };
  }

  @OnEvent(REALTIME_EVENTS.listUpdated)
  onListUpdated(event: ListRealtimeEvent) {
    this.broadcast(event);
  }

  @OnEvent(REALTIME_EVENTS.itemCreated)
  onItemCreated(event: ListRealtimeEvent) {
    this.broadcast(event);
  }

  @OnEvent(REALTIME_EVENTS.itemUpdated)
  onItemUpdated(event: ListRealtimeEvent) {
    this.broadcast(event);
  }

  @OnEvent(REALTIME_EVENTS.itemDeleted)
  onItemDeleted(event: ListRealtimeEvent) {
    this.broadcast(event);
  }

  @OnEvent(REALTIME_EVENTS.membersChanged)
  onMembersChanged(event: ListRealtimeEvent) {
    this.broadcast(event);
  }

  private broadcast(event: ListRealtimeEvent) {
    this.server.to(this.roomName(event.listId)).emit(event.type, event);
  }

  private socketUser(client: Socket): PresenceUser | undefined {
    return client.data.user as PresenceUser | undefined;
  }

  private roomName(listId: string) {
    return `list:${listId}`;
  }

  private roomsFor(client: Socket): string[] {
    const rooms: string[] = [];
    for (const [listId, sockets] of this.presence.entries()) {
      if (sockets.has(client.id)) {
        rooms.push(listId);
      }
    }
    return rooms;
  }

  private addPresence(listId: string, socketId: string, user: PresenceUser) {
    const room = this.presence.get(listId) ?? new Map<string, PresenceUser>();
    room.set(socketId, user);
    this.presence.set(listId, room);
  }

  private leaveRoom(client: Socket, listId: string) {
    void client.leave(this.roomName(listId));
    const room = this.presence.get(listId);
    if (!room) {
      return;
    }
    room.delete(client.id);
    if (room.size === 0) {
      this.presence.delete(listId);
    }
    this.emitPresence(listId);
  }

  private emitPresence(listId: string) {
    const room = this.presence.get(listId);
    const unique = new Map<string, PresenceUser>();
    for (const user of room?.values() ?? []) {
      unique.set(user.id, user);
    }
    this.server.to(this.roomName(listId)).emit('presence', {
      listId,
      users: [...unique.values()],
    });
  }
}
