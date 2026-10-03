import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes, randomUUID } from 'crypto';
import { AuditActor, auditCreate, auditDelete, auditUpdate, fieldChange } from '../common/audit';
import { AuthUser } from '../common/auth-user';
import {
  ItemRow,
  ListRow,
  MemberRole,
  MemberRow,
  ProfileRow,
  PublicMember,
  displayNameOf,
  ITEM_SELECT,
  toPublicItem,
  toPublicList,
} from '../common/types';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { resolveCurrency } from './currencies';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateItemDto,
  CreateListDto,
  UpdateItemDto,
  UpdateListDto,
} from './dto/list.dto';

@Injectable()
export class ListsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  async listForUser(userId: string) {
    const { data: memberships, error: memberError } = await this.supabase.client
      .from('list_members')
      .select('list_id, role')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (memberError) {
      throw new Error(memberError.message);
    }

    const ids = (memberships ?? []).map((row) => row.list_id as string);
    if (ids.length === 0) {
      return [];
    }

    const roleByList = new Map(
      (memberships ?? []).map((row) => [
        row.list_id as string,
        row.role as MemberRole,
      ]),
    );

    const { data: lists, error } = await this.supabase.client
      .from('lists')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const { data: items, error: itemsError } = await this.supabase.client
      .from('items')
      .select('list_id')
      .in('list_id', ids)
      .is('deleted_at', null);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const countByList = new Map<string, number>();
    for (const item of items ?? []) {
      const listId = item.list_id as string;
      countByList.set(listId, (countByList.get(listId) ?? 0) + 1);
    }

    return (lists ?? []).map((row) => {
      const list = row as ListRow;
      return {
        ...toPublicList(list, []),
        item_count: countByList.get(list.id) ?? 0,
        role: roleByList.get(list.id) ?? 'editor',
      };
    });
  }

  async getForUser(listId: string, userId: string) {
    await this.assertMember(listId, userId);
    return this.getListPayload(listId, userId);
  }

  async getByShareToken(token: string) {
    const list = await this.findByShareToken(token);
    return this.getListPayload(list.id);
  }

  async create(user: AuthUser, dto: CreateListDto) {
    const profile = await this.ensureProfile(user);
    const actor = { id: user.id, name: displayNameOf(profile) };
    const id = randomUUID();
    const description = dto.description?.trim() ?? '';
    const currency = resolveCurrency(dto.currency);
    const shareToken = this.newShareToken();
    const list = await this.callAudit<ListRow>('apply_list_insert', {
      p_actor_id: actor.id,
      p_list_action: auditCreate(actor, 'list', id),
      p_member_action: auditCreate(actor, 'list member', `${id} / ${user.id}`),
      p_id: id,
      p_name: dto.name.trim(),
      p_description: description,
      p_currency: currency,
      p_created_by_id: user.id,
      p_share_token: shareToken,
    });

    return {
      ...toPublicList(list, []),
      members: await this.getMembers(id),
      role: 'owner' as const,
    };
  }

  async update(listId: string, userId: string, dto: UpdateListDto) {
    await this.assertMember(listId, userId);
    return this.patchList(listId, dto, await this.actorFor(userId));
  }

  async updateByShareToken(token: string, dto: UpdateListDto) {
    const list = await this.findByShareToken(token);
    return this.patchList(list.id, dto, { id: null, name: 'unknown' });
  }

  async remove(listId: string, userId: string) {
    await this.assertOwner(listId, userId);
    const actor = await this.actorFor(userId);
    await this.callAudit('apply_list_soft_delete', {
      p_actor_id: actor.id,
      p_action: auditDelete(actor, 'list', listId),
      p_list_id: listId,
    });

    this.events.emit(REALTIME_EVENTS.listUpdated, {
      type: REALTIME_EVENTS.listUpdated,
      listId,
      list: { id: listId, deleted_at: new Date().toISOString() },
    });

    return { ok: true };
  }

  async createItem(listId: string, userId: string, dto: CreateItemDto) {
    await this.assertMember(listId, userId);
    return this.insertItem(listId, dto, await this.actorFor(userId));
  }

  async createItemByShareToken(token: string, dto: CreateItemDto) {
    const list = await this.findByShareToken(token);
    return this.insertItem(list.id, dto, { id: null, name: 'unknown' });
  }

  async updateItem(
    listId: string,
    itemId: string,
    userId: string,
    dto: UpdateItemDto,
  ) {
    await this.assertMember(listId, userId);
    return this.patchItem(listId, itemId, dto, await this.actorFor(userId));
  }

  async updateItemByShareToken(
    token: string,
    itemId: string,
    dto: UpdateItemDto,
  ) {
    const list = await this.findByShareToken(token);
    return this.patchItem(list.id, itemId, dto, { id: null, name: 'unknown' });
  }

  async removeItem(listId: string, itemId: string, userId: string) {
    await this.assertMember(listId, userId);
    return this.softDeleteItem(listId, itemId, await this.actorFor(userId));
  }

  async removeItemByShareToken(token: string, itemId: string) {
    const list = await this.findByShareToken(token);
    return this.softDeleteItem(list.id, itemId, { id: null, name: 'unknown' });
  }

  async getShareLink(listId: string, userId: string) {
    await this.assertMember(listId, userId);
    const list = await this.getActiveList(listId);
    return this.sharePayload(list.share_token);
  }

  async rotateShareToken(listId: string, userId: string) {
    await this.assertOwner(listId, userId);
    const actor = await this.actorFor(userId);
    const current = await this.getActiveList(listId);
    const token = this.newShareToken();
    await this.callAudit('apply_list_update', {
      p_actor_id: actor.id,
      p_action: auditUpdate(actor, 'list', listId, [
        { field: 'share_token', from: current.share_token, to: token },
      ]),
      p_list_id: listId,
      p_patch: { share_token: token },
    });
    return this.sharePayload(token);
  }

  async getMembers(listId: string): Promise<PublicMember[]> {
    const { data: members, error } = await this.supabase.client
      .from('list_members')
      .select('*')
      .eq('list_id', listId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message);
    }

    const userIds = (members ?? []).map((row) => row.user_id as string);
    if (userIds.length === 0) {
      return [];
    }

    const { data: profiles, error: profileError } = await this.supabase.client
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const profileById = new Map(
      (profiles ?? []).map((profile) => [
        profile.id as string,
        profile as ProfileRow,
      ]),
    );

    return (members ?? []).map((row) => {
      const member = row as MemberRow;
      const profile = profileById.get(member.user_id);
      return {
        user_id: member.user_id,
        email: profile?.email ?? '',
        display_name: profile ? displayNameOf(profile) : 'Member',
        role: member.role,
      };
    });
  }

  async assertMember(listId: string, userId: string): Promise<MemberRow> {
    await this.getActiveList(listId);
    const { data, error } = await this.supabase.client
      .from('list_members')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new ForbiddenException('You do not have access to this list');
    }
    return data as MemberRow;
  }

  async assertOwner(listId: string, userId: string): Promise<MemberRow> {
    const member = await this.assertMember(listId, userId);
    if (member.role !== 'owner') {
      throw new ForbiddenException('Only the list owner can do this');
    }
    return member;
  }

  async findByShareToken(token: string): Promise<ListRow> {
    const { data, error } = await this.supabase.client
      .from('lists')
      .select('*')
      .eq('share_token', token)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new NotFoundException('List not found');
    }
    return data as ListRow;
  }

  async ensureProfile(user: AuthUser): Promise<ProfileRow> {
    const { data: existing } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const profile = existing as ProfileRow;
    if (existing) {
      if (profile.email !== user.email) {
        const actor = { id: user.id, name: displayNameOf(profile) };
        return this.callAudit<ProfileRow>('apply_profile_update', {
          p_actor_id: actor.id,
          p_action: auditUpdate(actor, 'profile', user.id, [
            { field: 'email', from: profile.email, to: user.email },
          ]),
          p_id: user.id,
          p_patch: { email: user.email },
        });
      }
      return profile;
    }

    const displayName = user.email.split('@')[0];
    const actor = { id: user.id, name: displayName };
    return this.callAudit<ProfileRow>('apply_profile_insert', {
      p_actor_id: actor.id,
      p_action: auditCreate(actor, 'profile', user.id),
      p_id: user.id,
      p_email: user.email,
      p_display_name: displayName,
    });
  }

  private async getListPayload(listId: string, userId?: string) {
    const list = await this.getActiveList(listId);
    const items = await this.getActiveItems(listId);
    const members = await this.getMembers(listId);
    return {
      ...toPublicList(list, items),
      members,
      role: userId
        ? (members.find((member) => member.user_id === userId)?.role ?? 'editor')
        : ('editor' as const),
    };
  }

  private async patchList(listId: string, dto: UpdateListDto, actor: AuditActor) {
    const current = await this.getActiveList(listId);
    const nextName = dto.name !== undefined ? dto.name.trim() : current.name;
    const nextDescription =
      dto.description !== undefined ? dto.description.trim() : current.description;
    const nextCurrency =
      dto.currency !== undefined ? resolveCurrency(dto.currency) : (current.currency ?? 'BRL');
    const changes = [
      ...fieldChange('name', current.name, nextName),
      ...fieldChange('description', current.description, nextDescription),
      ...fieldChange('currency', current.currency, nextCurrency),
    ];
    if (changes.length === 0) {
      const items = await this.getActiveItems(listId);
      return toPublicList(current, items);
    }

    const patch: Record<string, string> = {};
    if (dto.name !== undefined) patch.name = nextName;
    if (dto.description !== undefined) patch.description = nextDescription;
    if (dto.currency !== undefined) patch.currency = nextCurrency;

    const list = await this.callAudit<ListRow>('apply_list_update', {
      p_actor_id: actor.id,
      p_action: auditUpdate(actor, 'list', listId, changes),
      p_list_id: listId,
      p_patch: patch,
    });

    const items = await this.getActiveItems(listId);
    const publicList = toPublicList(list, items);
    this.events.emit(REALTIME_EVENTS.listUpdated, {
      type: REALTIME_EVENTS.listUpdated,
      listId,
      list: publicList,
    });
    return publicList;
  }

  private async insertItem(listId: string, dto: CreateItemDto, actor: AuditActor) {
    if (dto.grocery_type_id) {
      await this.assertGroceryType(dto.grocery_type_id);
    }
    const id = randomUUID();
    const created = await this.callAudit<ItemRow>('apply_item_insert', {
      p_actor_id: actor.id,
      p_action: auditCreate(actor, 'item', id),
      p_id: id,
      p_list_id: listId,
      p_grocery_type_id: dto.grocery_type_id ?? null,
      p_name: dto.name.trim(),
      p_description: dto.description?.trim() ?? '',
      p_amount: dto.amount?.trim() ?? '',
      p_price: dto.price ?? 0,
      p_checked: dto.checked ?? false,
    });
    const item = await this.reloadItem(created.id);
    const publicItem = toPublicItem(item);
    this.events.emit(REALTIME_EVENTS.itemCreated, {
      type: REALTIME_EVENTS.itemCreated,
      listId,
      item: publicItem,
    });
    await this.touchList(listId);
    return publicItem;
  }

  private async patchItem(
    listId: string,
    itemId: string,
    dto: UpdateItemDto,
    actor: AuditActor,
  ) {
    const current = await this.reloadItem(itemId);
    if (current.list_id !== listId || current.deleted_at) {
      throw new NotFoundException('Item not found');
    }
    if (dto.grocery_type_id) {
      await this.assertGroceryType(dto.grocery_type_id);
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : current.name;
    const nextDescription =
      dto.description !== undefined ? dto.description.trim() : current.description;
    const nextAmount = dto.amount !== undefined ? dto.amount.trim() : current.amount;
    const nextPrice = dto.price !== undefined ? dto.price : Number(current.price);
    const nextChecked = dto.checked !== undefined ? dto.checked : Boolean(current.checked);
    const nextType =
      dto.grocery_type_id !== undefined ? dto.grocery_type_id : current.grocery_type_id;
    const changes = [
      ...fieldChange('name', current.name, nextName),
      ...fieldChange('description', current.description, nextDescription),
      ...fieldChange('amount', current.amount, nextAmount),
      ...fieldChange('price', current.price, nextPrice),
      ...fieldChange('checked', current.checked, nextChecked),
      ...fieldChange('grocery_type_id', current.grocery_type_id, nextType),
    ];
    if (changes.length === 0) {
      return toPublicItem(current);
    }

    const patch: Record<string, string | number | boolean | null> = {};
    if (dto.name !== undefined) patch.name = nextName;
    if (dto.description !== undefined) patch.description = nextDescription;
    if (dto.amount !== undefined) patch.amount = nextAmount;
    if (dto.price !== undefined) patch.price = nextPrice;
    if (dto.checked !== undefined) patch.checked = nextChecked;
    if (dto.grocery_type_id !== undefined) patch.grocery_type_id = nextType;

    await this.callAudit('apply_item_update', {
      p_actor_id: actor.id,
      p_action: auditUpdate(actor, 'item', itemId, changes),
      p_item_id: itemId,
      p_list_id: listId,
      p_patch: patch,
    });
    const item = await this.reloadItem(itemId);
    const publicItem = toPublicItem(item);
    this.events.emit(REALTIME_EVENTS.itemUpdated, {
      type: REALTIME_EVENTS.itemUpdated,
      listId,
      item: publicItem,
    });
    await this.touchList(listId);
    return publicItem;
  }

  private async softDeleteItem(listId: string, itemId: string, actor: AuditActor) {
    await this.callAudit('apply_item_soft_delete', {
      p_actor_id: actor.id,
      p_action: auditDelete(actor, 'item', itemId),
      p_item_id: itemId,
      p_list_id: listId,
    });

    this.events.emit(REALTIME_EVENTS.itemDeleted, {
      type: REALTIME_EVENTS.itemDeleted,
      listId,
      itemId,
    });
    await this.touchList(listId);
    return { ok: true };
  }

  private sharePayload(token: string) {
    const scheme = this.config.get<string>('APP_SCHEME') ?? 'baiol';
    const webAppUrl = (
      this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:8081'
    ).replace(/\/$/, '');
    return {
      token,
      app_link: `${scheme}://join/${token}`,
      web_link: `${webAppUrl}/join/${token}`,
    };
  }

  private newShareToken() {
    return randomBytes(16).toString('hex');
  }

  private async getActiveList(listId: string): Promise<ListRow> {
    const { data, error } = await this.supabase.client
      .from('lists')
      .select('*')
      .eq('id', listId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new NotFoundException('List not found');
    }
    return data as ListRow;
  }

  private async getActiveItems(listId: string): Promise<ItemRow[]> {
    const embedded = await this.supabase.client
      .from('items')
      .select(ITEM_SELECT)
      .eq('list_id', listId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!embedded.error) {
      return (embedded.data ?? []) as ItemRow[];
    }
    if (!this.missingGrocerySchema(embedded.error.message)) {
      throw new Error(embedded.error.message);
    }

    const plain = await this.supabase.client
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (plain.error) {
      throw new Error(plain.error.message);
    }
    return (plain.data ?? []) as ItemRow[];
  }

  async listGroceryTypes() {
    const { data, error } = await this.supabase.client
      .from('grocery_types')
      .select('id, code, name, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      if (this.missingGrocerySchema(error.message)) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  }

  private missingGrocerySchema(message: string): boolean {
    return message.includes('grocery_types') || message.includes('grocery_type_id');
  }

  private async assertGroceryType(id: string) {
    const { data, error } = await this.supabase.client
      .from('grocery_types')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new BadRequestException('Unknown grocery type');
    }
  }

  private async actorFor(userId: string): Promise<AuditActor> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('display_name, email')
      .eq('id', userId)
      .maybeSingle();
    const email = (data?.email as string | undefined) ?? '';
    const name = (data?.display_name as string | null)?.trim() || email.split('@')[0] || 'unknown';
    return { id: userId, name };
  }

  private async callAudit<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.client.rpc(fn, args);
    if (error || data == null) {
      const message = error?.message ?? 'Could not write audit log';
      if (message.toLowerCase().includes('not found')) {
        throw new NotFoundException(message);
      }
      throw new InternalServerErrorException(message);
    }
    return data as T;
  }

  private async reloadItem(itemId: string): Promise<ItemRow> {
    const { data, error } = await this.supabase.client
      .from('items')
      .select(ITEM_SELECT)
      .eq('id', itemId)
      .maybeSingle();
    if (error || !data) {
      throw new NotFoundException(error?.message ?? 'Item not found');
    }
    return data as ItemRow;
  }

  private async touchList(listId: string) {
    await this.supabase.client
      .from('lists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', listId);
  }
}
