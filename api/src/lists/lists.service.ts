import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes, randomUUID } from 'crypto';
import { AuditActor, auditCreate, auditDelete, auditUpdate, fieldChange } from '../common/audit';
import { AuthUser } from '../common/auth-user';
import { fromPersistence } from '../common/map-persistence-error';
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
import { GroceryTypeRepository } from '../persistence/grocery-type.repository';
import { ItemRepository } from '../persistence/item.repository';
import { ListRepository } from '../persistence/list.repository';
import { MemberRepository } from '../persistence/member.repository';
import { UserRepository } from '../persistence/user.repository';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { resolveCurrency } from './currencies';
import { CreateItemDto, CreateListDto, UpdateItemDto, UpdateListDto } from './dto/list.dto';

@Injectable()
export class ListsService {
  constructor(
    private readonly users: UserRepository,
    private readonly listStore: ListRepository,
    private readonly itemStore: ItemRepository,
    private readonly memberStore: MemberRepository,
    private readonly groceryTypes: GroceryTypeRepository,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await fromPersistence(this.listStore.membershipsForUser(userId));
    const ids = memberships.map((row) => row.list_id);
    if (ids.length === 0) {
      return [];
    }

    const roleByList = new Map(
      memberships.map((row) => [row.list_id, row.role as MemberRole]),
    );
    const lists = await fromPersistence(this.listStore.findActiveByIds(ids));
    const countByList = await fromPersistence(this.listStore.countActiveItems(ids));

    return lists.map((list) => ({
      ...toPublicList(list, []),
      item_count: countByList.get(list.id) ?? 0,
      role: roleByList.get(list.id) ?? 'editor',
    }));
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
    const list = await fromPersistence(
      this.listStore.insert({
        actorId: actor.id,
        listAction: auditCreate(actor, 'list', id),
        memberAction: auditCreate(actor, 'list member', `${id} / ${user.id}`),
        id,
        name: dto.name.trim(),
        description,
        currency,
        createdById: user.id,
        shareToken,
      }),
    );

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
    await fromPersistence(
      this.listStore.softDelete({
        actorId: actor.id,
        action: auditDelete(actor, 'list', listId),
        listId,
      }),
    );

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

  async updateItem(listId: string, itemId: string, userId: string, dto: UpdateItemDto) {
    await this.assertMember(listId, userId);
    return this.patchItem(listId, itemId, dto, await this.actorFor(userId));
  }

  async updateItemByShareToken(token: string, itemId: string, dto: UpdateItemDto) {
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
    await fromPersistence(
      this.listStore.update({
        actorId: actor.id,
        action: auditUpdate(actor, 'list', listId, [
          { field: 'share_token', from: current.share_token, to: token },
        ]),
        listId,
        patch: { share_token: token },
      }),
    );
    return this.sharePayload(token);
  }

  async getMembers(listId: string): Promise<PublicMember[]> {
    const members = await fromPersistence(this.memberStore.listActive(listId));
    const userIds = members.map((row) => row.user_id);
    if (userIds.length === 0) {
      return [];
    }

    const accounts = await fromPersistence(this.users.findByIds(userIds));
    const profileById = new Map(accounts.map((account) => [account.id, account]));

    return members.map((member) => {
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
    const member = await fromPersistence(this.memberStore.findActive(listId, userId));
    if (!member) {
      throw new ForbiddenException('You do not have access to this list');
    }
    return member;
  }

  async assertOwner(listId: string, userId: string): Promise<MemberRow> {
    const member = await this.assertMember(listId, userId);
    if (member.role !== 'owner') {
      throw new ForbiddenException('Only the list owner can do this');
    }
    return member;
  }

  async findByShareToken(token: string): Promise<ListRow> {
    const list = await fromPersistence(this.listStore.findActiveByShareToken(token));
    if (!list) {
      throw new NotFoundException('List not found');
    }
    return list;
  }

  async ensureProfile(user: AuthUser): Promise<ProfileRow> {
    const profile = await fromPersistence(this.users.findById(user.id));
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  async listGroceryTypes() {
    return fromPersistence(this.groceryTypes.listActive());
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

    const list = await fromPersistence(
      this.listStore.update({
        actorId: actor.id,
        action: auditUpdate(actor, 'list', listId, changes),
        listId,
        patch,
      }),
    );

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
    const created = await fromPersistence(
      this.itemStore.insert({
        actorId: actor.id,
        action: auditCreate(actor, 'item', id),
        id,
        listId,
        groceryTypeId: dto.grocery_type_id ?? null,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        amount: dto.amount?.trim() ?? '',
        price: dto.price ?? 0,
        checked: dto.checked ?? false,
      }),
    );
    const item = await this.reloadItem(created.id);
    const publicItem = toPublicItem(item);
    this.events.emit(REALTIME_EVENTS.itemCreated, {
      type: REALTIME_EVENTS.itemCreated,
      listId,
      item: publicItem,
    });
    await fromPersistence(this.listStore.touch(listId));
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

    await fromPersistence(
      this.itemStore.update({
        actorId: actor.id,
        action: auditUpdate(actor, 'item', itemId, changes),
        itemId,
        listId,
        patch,
      }),
    );
    const item = await this.reloadItem(itemId);
    const publicItem = toPublicItem(item);
    this.events.emit(REALTIME_EVENTS.itemUpdated, {
      type: REALTIME_EVENTS.itemUpdated,
      listId,
      item: publicItem,
    });
    await fromPersistence(this.listStore.touch(listId));
    return publicItem;
  }

  private async softDeleteItem(listId: string, itemId: string, actor: AuditActor) {
    await fromPersistence(
      this.itemStore.softDelete({
        actorId: actor.id,
        action: auditDelete(actor, 'item', itemId),
        itemId,
        listId,
      }),
    );

    this.events.emit(REALTIME_EVENTS.itemDeleted, {
      type: REALTIME_EVENTS.itemDeleted,
      listId,
      itemId,
    });
    await fromPersistence(this.listStore.touch(listId));
    return { ok: true };
  }

  private sharePayload(token: string) {
    const scheme = this.config.getOrThrow<string>('APP_SCHEME');
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL').replace(/\/$/, '');
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
    const list = await fromPersistence(this.listStore.findActiveById(listId));
    if (!list) {
      throw new NotFoundException('List not found');
    }
    return list;
  }

  private getActiveItems(listId: string): Promise<ItemRow[]> {
    return fromPersistence(this.itemStore.listActive(listId));
  }

  private async assertGroceryType(id: string) {
    const exists = await fromPersistence(this.groceryTypes.existsActive(id));
    if (!exists) {
      throw new BadRequestException('Unknown grocery type');
    }
  }

  private async actorFor(userId: string): Promise<AuditActor> {
    const profile = await fromPersistence(this.users.findById(userId));
    if (!profile) {
      return { id: userId, name: 'unknown' };
    }
    return { id: userId, name: displayNameOf(profile) };
  }

  private async reloadItem(itemId: string): Promise<ItemRow> {
    const item = await fromPersistence(this.itemStore.findById(itemId));
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }
}
