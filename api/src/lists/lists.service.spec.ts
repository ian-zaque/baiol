import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { UserRepository } from '../persistence/user.repository';
import { ListRepository } from '../persistence/list.repository';
import { ItemRepository } from '../persistence/item.repository';
import { MemberRepository } from '../persistence/member.repository';
import { GroceryTypeRepository } from '../persistence/grocery-type.repository';

const user = { id: 'user-1', email: 'ada@example.com' };
const profile = {
  id: 'user-1',
  email: 'ada@example.com',
  display_name: 'Ada',
  created_at: '2026-01-01T00:00:00.000Z',
};

const listRow = {
  id: 'list-1',
  name: 'October',
  description: '',
  currency: 'BRL',
  created_by_id: user.id,
  share_token: 'token',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

const itemRow = {
  id: 'item-1',
  list_id: 'list-1',
  grocery_type_id: null,
  name: 'Milk',
  description: '',
  amount: '1 L',
  price: 5,
  checked: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

describe('ListsService', () => {
  const users = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findActiveByEmail: jest.fn(),
    insert: jest.fn(),
    updateDisplayName: jest.fn(),
  };
  const listStore = {
    membershipsForUser: jest.fn(),
    findActiveByIds: jest.fn(),
    countActiveItems: jest.fn(),
    findActiveById: jest.fn(),
    findActiveByShareToken: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    touch: jest.fn(),
  };
  const itemStore = {
    listActive: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  const memberStore = {
    listActive: jest.fn(),
    findActive: jest.fn(),
  };
  const groceryTypes = {
    listActive: jest.fn(),
    existsActive: jest.fn(),
  };

  let service: ListsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    listStore.touch.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ListsService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: UserRepository, useValue: users },
        { provide: ListRepository, useValue: listStore },
        { provide: ItemRepository, useValue: itemStore },
        { provide: MemberRepository, useValue: memberStore },
        { provide: GroceryTypeRepository, useValue: groceryTypes },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'APP_SCHEME' ? 'baiol' : 'http://localhost:8081',
          },
        },
      ],
    }).compile();
    service = moduleRef.get(ListsService);
  });

  it('creates a list and an owner membership with log sentences', async () => {
    users.findById.mockResolvedValue(profile);
    users.findByIds.mockResolvedValue([profile]);
    memberStore.listActive.mockResolvedValue([
      { list_id: 'list-1', user_id: user.id, role: 'owner', created_at: profile.created_at },
    ]);
    listStore.insert.mockImplementation(async (input: { id: string }) => ({
      ...listRow,
      id: input.id,
    }));

    const list = await service.create(user, { name: 'October' });

    expect(listStore.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: user.id,
        name: 'October',
        currency: 'BRL',
        createdById: user.id,
      }),
    );
    const args = listStore.insert.mock.calls[0][0] as {
      id: string;
      listAction: string;
      memberAction: string;
    };
    expect(args.listAction).toBe(`User Ada (user-1) created the list (${args.id}).`);
    expect(args.memberAction).toBe(
      `User Ada (user-1) created the list member (${args.id} / user-1).`,
    );
    expect(list.name).toBe('October');
    expect(list.role).toBe('owner');
  });

  it('updates a list field and records the previous and next value', async () => {
    listStore.findActiveById.mockResolvedValue(listRow);
    memberStore.findActive.mockResolvedValue({
      list_id: 'list-1',
      user_id: user.id,
      role: 'owner',
      created_at: profile.created_at,
    });
    users.findById.mockResolvedValue(profile);
    itemStore.listActive.mockResolvedValue([]);
    listStore.update.mockResolvedValue({ ...listRow, name: 'November' });

    const list = await service.update('list-1', user.id, { name: 'November' });

    expect(listStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 'list-1',
        patch: { name: 'November' },
        action: 'User Ada (user-1) updated the list (list-1) field name from October to November.',
      }),
    );
    expect(list.name).toBe('November');
  });

  it('soft-deletes a list with a delete sentence', async () => {
    listStore.findActiveById.mockResolvedValue(listRow);
    memberStore.findActive.mockResolvedValue({
      list_id: 'list-1',
      user_id: user.id,
      role: 'owner',
      created_at: profile.created_at,
    });
    users.findById.mockResolvedValue(profile);
    listStore.softDelete.mockResolvedValue(undefined);

    await service.remove('list-1', user.id);

    expect(listStore.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 'list-1',
        action: 'User Ada (user-1) deleted the list (list-1).',
      }),
    );
  });

  it('creates, checks, and deletes an item', async () => {
    listStore.findActiveById.mockResolvedValue(listRow);
    memberStore.findActive.mockResolvedValue({
      list_id: 'list-1',
      user_id: user.id,
      role: 'editor',
      created_at: profile.created_at,
    });
    users.findById.mockResolvedValue(profile);
    itemStore.insert.mockImplementation(async (input: { id: string }) => ({
      ...itemRow,
      id: input.id,
    }));
    itemStore.findById.mockImplementation(async (id: string) => ({ ...itemRow, id }));

    const created = await service.createItem('list-1', user.id, {
      name: 'Milk',
      amount: '1 L',
      price: 5,
    });
    const createArgs = itemStore.insert.mock.calls[0][0] as { id: string; action: string };
    expect(itemStore.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Milk',
        amount: '1 L',
        price: 5,
      }),
    );
    expect(createArgs.action).toBe(`User Ada (user-1) created the item (${createArgs.id}).`);
    expect(created.name).toBe('Milk');

    itemStore.findById.mockResolvedValueOnce(itemRow).mockResolvedValueOnce({
      ...itemRow,
      checked: true,
    });
    itemStore.update.mockResolvedValue({ ...itemRow, checked: true });

    const checked = await service.updateItem('list-1', itemRow.id, user.id, { checked: true });
    expect(itemStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: itemRow.id,
        patch: { checked: true },
        action: 'User Ada (user-1) updated the item (item-1) field checked from false to true.',
      }),
    );
    expect(checked.checked).toBe(true);

    itemStore.softDelete.mockResolvedValue(undefined);
    await service.removeItem('list-1', itemRow.id, user.id);
    expect(itemStore.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: itemRow.id,
        action: 'User Ada (user-1) deleted the item (item-1).',
      }),
    );
  });

  it('does not write a log when a list update changes nothing', async () => {
    listStore.findActiveById.mockResolvedValue(listRow);
    memberStore.findActive.mockResolvedValue({
      list_id: 'list-1',
      user_id: user.id,
      role: 'owner',
      created_at: profile.created_at,
    });
    users.findById.mockResolvedValue(profile);
    itemStore.listActive.mockResolvedValue([]);

    await service.update('list-1', user.id, { name: 'October' });

    expect(listStore.update).not.toHaveBeenCalled();
  });

  it('loads an existing user and does not create one', async () => {
    users.findById.mockResolvedValue(profile);

    await expect(service.ensureProfile(user)).resolves.toEqual(profile);
    expect(users.insert).not.toHaveBeenCalled();
  });

  it('rejects sign-in when the user row is missing', async () => {
    users.findById.mockResolvedValue(null);

    await expect(service.ensureProfile(user)).rejects.toBeInstanceOf(NotFoundException);
    expect(users.insert).not.toHaveBeenCalled();
  });

  it('records a guest item edit as unknown', async () => {
    listStore.findActiveByShareToken.mockResolvedValue(listRow);
    itemStore.findById
      .mockResolvedValueOnce(itemRow)
      .mockResolvedValueOnce({ ...itemRow, name: 'Oat milk' });
    itemStore.update.mockResolvedValue({ ...itemRow, name: 'Oat milk' });

    await service.updateItemByShareToken('token', itemRow.id, { name: 'Oat milk' });

    expect(itemStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        action:
          'User unknown (unknown) updated the item (item-1) field name from Milk to Oat milk.',
      }),
    );
  });
});
