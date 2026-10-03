import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ListsService } from './lists.service';
import { SupabaseService } from '../supabase/supabase.service';

const user = { id: 'user-1', email: 'ada@example.com' };
const profile = {
  id: 'user-1',
  email: 'ada@example.com',
  display_name: 'Ada',
  created_at: '2026-01-01T00:00:00.000Z',
};

function query(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ['select', 'eq', 'is', 'in', 'order', 'update']) {
    chain[method] = self;
  }
  chain.maybeSingle = () => Promise.resolve(result);
  chain.single = () => Promise.resolve(result);
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe('ListsService', () => {
  const queues = new Map<string, { data: unknown; error: { message: string } | null }[]>();
  const rpc = jest.fn();

  function push(table: string, data: unknown) {
    const list = queues.get(table) ?? [];
    list.push({ data, error: null });
    queues.set(table, list);
  }

  const client = {
    from: (table: string) => {
      const list = queues.get(table);
      const next = list?.shift();
      if (!next) {
        throw new Error(`No mock left for ${table}`);
      }
      return query(next);
    },
    rpc,
  };

  let service: ListsService;

  beforeEach(async () => {
    queues.clear();
    rpc.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ListsService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SupabaseService, useValue: { client } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = moduleRef.get(ListsService);
  });

  it('creates a list and an owner membership with log sentences', async () => {
    push('profiles', profile);
    push('list_members', [{ list_id: 'list-1', user_id: user.id, role: 'owner' }]);
    push('profiles', [profile]);
    rpc.mockImplementation(async (_fn: string, args: { p_id: string }) => ({
      data: {
        id: args.p_id,
        name: 'October',
        description: '',
        currency: 'BRL',
        created_by_id: user.id,
        share_token: 'token',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
      error: null,
    }));

    const list = await service.create(user, { name: 'October' });

    expect(rpc).toHaveBeenCalledWith(
      'apply_list_insert',
      expect.objectContaining({
        p_actor_id: user.id,
        p_name: 'October',
        p_currency: 'BRL',
        p_created_by_id: user.id,
      }),
    );
    const args = rpc.mock.calls[0][1] as {
      p_id: string;
      p_list_action: string;
      p_member_action: string;
    };
    expect(args.p_list_action).toBe(`User Ada (user-1) created the list (${args.p_id}).`);
    expect(args.p_member_action).toBe(
      `User Ada (user-1) created the list member (${args.p_id} / user-1).`,
    );
    expect(list.name).toBe('October');
    expect(list.role).toBe('owner');
  });

  it('updates a list field and records the previous and next value', async () => {
    const current = {
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
    push('lists', current);
    push('list_members', { list_id: 'list-1', user_id: user.id, role: 'owner' });
    push('profiles', profile);
    push('lists', current);
    push('items', []);
    rpc.mockResolvedValue({ data: { ...current, name: 'November' }, error: null });

    const list = await service.update('list-1', user.id, { name: 'November' });

    expect(rpc).toHaveBeenCalledWith(
      'apply_list_update',
      expect.objectContaining({
        p_list_id: 'list-1',
        p_patch: { name: 'November' },
        p_action: 'User Ada (user-1) updated the list (list-1) field name from October to November.',
      }),
    );
    expect(list.name).toBe('November');
  });

  it('soft-deletes a list with a delete sentence', async () => {
    push('lists', {
      id: 'list-1',
      name: 'October',
      description: '',
      currency: 'BRL',
      created_by_id: user.id,
      share_token: 'token',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
    });
    push('list_members', { list_id: 'list-1', user_id: user.id, role: 'owner' });
    push('profiles', profile);
    rpc.mockResolvedValue({ data: { id: 'list-1', deleted_at: '2026-02-01T00:00:00.000Z' }, error: null });

    await service.remove('list-1', user.id);

    expect(rpc).toHaveBeenCalledWith(
      'apply_list_soft_delete',
      expect.objectContaining({
        p_list_id: 'list-1',
        p_action: 'User Ada (user-1) deleted the list (list-1).',
      }),
    );
  });

  it('creates, checks, and deletes an item', async () => {
    const list = {
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
    const item = {
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

    push('lists', list);
    push('list_members', { list_id: 'list-1', user_id: user.id, role: 'editor' });
    push('profiles', profile);
    push('items', item);
    push('lists', { data: null });
    rpc.mockImplementation(async (_fn: string, args: { p_id: string }) => ({
      data: { ...item, id: args.p_id },
      error: null,
    }));

    const created = await service.createItem('list-1', user.id, { name: 'Milk', amount: '1 L', price: 5 });
    expect(rpc).toHaveBeenCalledWith(
      'apply_item_insert',
      expect.objectContaining({
        p_name: 'Milk',
        p_amount: '1 L',
        p_price: 5,
      }),
    );
    const createArgs = rpc.mock.calls[0][1] as { p_id: string; p_action: string };
    expect(createArgs.p_action).toBe(`User Ada (user-1) created the item (${createArgs.p_id}).`);
    expect(created.name).toBe('Milk');

    queues.clear();
    rpc.mockReset();
    push('lists', list);
    push('list_members', { list_id: 'list-1', user_id: user.id, role: 'editor' });
    push('profiles', profile);
    push('items', item);
    push('items', { ...item, checked: true });
    push('lists', { data: null });
    rpc.mockResolvedValue({ data: { ...item, checked: true }, error: null });

    const checked = await service.updateItem('list-1', item.id, user.id, { checked: true });
    expect(rpc).toHaveBeenCalledWith(
      'apply_item_update',
      expect.objectContaining({
        p_item_id: item.id,
        p_patch: { checked: true },
        p_action: 'User Ada (user-1) updated the item (item-1) field checked from false to true.',
      }),
    );
    expect(checked.checked).toBe(true);

    queues.clear();
    rpc.mockReset();
    push('lists', list);
    push('list_members', { list_id: 'list-1', user_id: user.id, role: 'editor' });
    push('profiles', profile);
    push('lists', { data: null });
    rpc.mockResolvedValue({ data: { ...item, deleted_at: '2026-02-01T00:00:00.000Z' }, error: null });

    await service.removeItem('list-1', item.id, user.id);
    expect(rpc).toHaveBeenCalledWith(
      'apply_item_soft_delete',
      expect.objectContaining({
        p_item_id: item.id,
        p_action: 'User Ada (user-1) deleted the item (item-1).',
      }),
    );
  });

  it('does not write a log when a list update changes nothing', async () => {
    const current = {
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
    push('lists', current);
    push('list_members', { list_id: 'list-1', user_id: user.id, role: 'owner' });
    push('profiles', profile);
    push('lists', current);
    push('items', []);

    await service.update('list-1', user.id, { name: 'October' });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('creates a profile log when sign-in finds no profile row', async () => {
    push('profiles', null);
    rpc.mockResolvedValue({
      data: {
        id: user.id,
        email: user.email,
        display_name: 'ada',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const created = await service.ensureProfile(user);

    expect(rpc).toHaveBeenCalledWith(
      'apply_profile_insert',
      expect.objectContaining({
        p_action: 'User ada (user-1) created the profile (user-1).',
        p_email: user.email,
        p_display_name: 'ada',
      }),
    );
    expect(created.display_name).toBe('ada');
  });

  it('logs an email change when the signed-in address differs from the profile', async () => {
    push('profiles', { ...profile, email: 'old@example.com' });
    rpc.mockResolvedValue({
      data: { ...profile, email: user.email },
      error: null,
    });

    await service.ensureProfile(user);

    expect(rpc).toHaveBeenCalledWith(
      'apply_profile_update',
      expect.objectContaining({
        p_action: 'User Ada (user-1) updated the profile (user-1) field email from old@example.com to ada@example.com.',
        p_patch: { email: user.email },
      }),
    );
  });

  it('records a guest item edit as unknown', async () => {
    const list = {
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
    const item = {
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
    push('lists', list);
    push('items', item);
    push('items', { ...item, name: 'Oat milk' });
    push('lists', null);
    rpc.mockResolvedValue({ data: { ...item, name: 'Oat milk' }, error: null });

    await service.updateItemByShareToken('token', item.id, { name: 'Oat milk' });

    expect(rpc).toHaveBeenCalledWith(
      'apply_item_update',
      expect.objectContaining({
        p_actor_id: null,
        p_action:
          'User unknown (unknown) updated the item (item-1) field name from Milk to Oat milk.',
      }),
    );
  });
});
