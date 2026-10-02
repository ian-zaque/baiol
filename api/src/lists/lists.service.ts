import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthUser } from '../common/auth-user';
import {
  ItemRow,
  ListRow,
  MemberRole,
  MemberRow,
  ProfileRow,
  PublicMember,
  displayNameOf,
  toPublicItem,
  toPublicList,
} from '../common/types';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
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
  ) {}

  async listForUser(userId: string) {
    const { data: memberships, error: memberError } = await this.supabase.client
      .from('list_members')
      .select('list_id, role')
      .eq('user_id', userId);

    if (memberError) {
      throw new Error(memberError.message);
    }

    const ids = (memberships ?? []).map((row) => row.list_id as string);
    if (ids.length === 0) {
      return [];
    }

    const roleByList = new Map(
      (memberships ?? []).map((row) => [row.list_id as string, row.role as MemberRole]),
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
    const list = await this.getActiveList(listId);
    const items = await this.getActiveItems(listId);
    const members = await this.getMembers(listId);
    return {
      ...toPublicList(list, items),
      members,
      role: members.find((member) => member.user_id === userId)?.role ?? 'editor',
    };
  }

  async create(user: AuthUser, dto: CreateListDto) {
    await this.ensureProfile(user);

    const { data: list, error } = await this.supabase.client
      .from('lists')
      .insert({
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        created_by_id: user.id,
      })
      .select('*')
      .single();

    if (error || !list) {
      throw new Error(error?.message ?? 'Could not create list');
    }

    const { error: memberError } = await this.supabase.client
      .from('list_members')
      .insert({
        list_id: list.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      throw new Error(memberError.message);
    }

    return {
      ...toPublicList(list as ListRow, []),
      members: await this.getMembers(list.id as string),
      role: 'owner' as const,
    };
  }

  async update(listId: string, userId: string, dto: UpdateListDto) {
    await this.assertMember(listId, userId);

    const patch: Record<string, string> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description.trim();

    const { data: list, error } = await this.supabase.client
      .from('lists')
      .update(patch)
      .eq('id', listId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error || !list) {
      throw new NotFoundException('List not found');
    }

    const items = await this.getActiveItems(listId);
    const publicList = toPublicList(list as ListRow, items);
    this.events.emit(REALTIME_EVENTS.listUpdated, {
      type: REALTIME_EVENTS.listUpdated,
      listId,
      list: publicList,
    });
    return publicList;
  }

  async remove(listId: string, userId: string) {
    await this.assertOwner(listId, userId);
    const { error } = await this.supabase.client
      .from('lists')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', listId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message);
    }

    this.events.emit(REALTIME_EVENTS.listUpdated, {
      type: REALTIME_EVENTS.listUpdated,
      listId,
      list: { id: listId, deleted_at: new Date().toISOString() },
    });

    return { ok: true };
  }

  async createItem(listId: string, userId: string, dto: CreateItemDto) {
    await this.assertMember(listId, userId);

    const { data: item, error } = await this.supabase.client
      .from('items')
      .insert({
        list_id: listId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        amount: dto.amount?.trim() ?? '',
        price: dto.price ?? 0,
      })
      .select('*')
      .single();

    if (error || !item) {
      throw new Error(error?.message ?? 'Could not create item');
    }

    const publicItem = toPublicItem(item as ItemRow);
    this.events.emit(REALTIME_EVENTS.itemCreated, {
      type: REALTIME_EVENTS.itemCreated,
      listId,
      item: publicItem,
    });
    await this.touchList(listId);
    return publicItem;
  }

  async updateItem(
    listId: string,
    itemId: string,
    userId: string,
    dto: UpdateItemDto,
  ) {
    await this.assertMember(listId, userId);

    const patch: Record<string, string | number> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description.trim();
    if (dto.amount !== undefined) patch.amount = dto.amount.trim();
    if (dto.price !== undefined) patch.price = dto.price;

    const { data: item, error } = await this.supabase.client
      .from('items')
      .update(patch)
      .eq('id', itemId)
      .eq('list_id', listId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error || !item) {
      throw new NotFoundException('Item not found');
    }

    const publicItem = toPublicItem(item as ItemRow);
    this.events.emit(REALTIME_EVENTS.itemUpdated, {
      type: REALTIME_EVENTS.itemUpdated,
      listId,
      item: publicItem,
    });
    await this.touchList(listId);
    return publicItem;
  }

  async removeItem(listId: string, itemId: string, userId: string) {
    await this.assertMember(listId, userId);
    const { error } = await this.supabase.client
      .from('items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('list_id', listId)
      .is('deleted_at', null);

    if (error) {
      throw new NotFoundException('Item not found');
    }

    this.events.emit(REALTIME_EVENTS.itemDeleted, {
      type: REALTIME_EVENTS.itemDeleted,
      listId,
      itemId,
    });
    await this.touchList(listId);
    return { ok: true };
  }

  async getMembers(listId: string): Promise<PublicMember[]> {
    const { data: members, error } = await this.supabase.client
      .from('list_members')
      .select('*')
      .eq('list_id', listId);

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
      (profiles ?? []).map((profile) => [profile.id as string, profile as ProfileRow]),
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

  async emitMembersChanged(listId: string) {
    const members = await this.getMembers(listId);
    this.events.emit(REALTIME_EVENTS.membersChanged, {
      type: REALTIME_EVENTS.membersChanged,
      listId,
      members,
    });
    return members;
  }

  async assertMember(listId: string, userId: string): Promise<MemberRow> {
    await this.getActiveList(listId);
    const { data, error } = await this.supabase.client
      .from('list_members')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
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

  async ensureProfile(user: AuthUser): Promise<ProfileRow> {
    const { data: existing } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      if ((existing.email as string) !== user.email) {
        const { data: updated, error } = await this.supabase.client
          .from('profiles')
          .update({ email: user.email })
          .eq('id', user.id)
          .select('*')
          .single();
        if (error || !updated) {
          throw new Error(error?.message ?? 'Could not update profile');
        }
        return updated as ProfileRow;
      }
      return existing as ProfileRow;
    }

    const { data, error } = await this.supabase.client
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.email.split('@')[0],
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create profile');
    }
    return data as ProfileRow;
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
    const { data, error } = await this.supabase.client
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []) as ItemRow[];
  }

  private async touchList(listId: string) {
    await this.supabase.client
      .from('lists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', listId);
  }
}
