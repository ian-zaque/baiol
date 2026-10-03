import { auditCreate, auditDelete, auditUpdate, fieldChange } from './audit';

const ada = { id: 'user-1', name: 'Ada' };

describe('audit sentences', () => {
  it('describes a create', () => {
    expect(auditCreate(ada, 'list', 'list-1')).toBe('User Ada (user-1) created the list (list-1).');
  });

  it('describes a delete', () => {
    expect(auditDelete(ada, 'item', 'item-1')).toBe('User Ada (user-1) deleted the item (item-1).');
  });

  it('describes each changed field and skips values that did not change', () => {
    expect(fieldChange('name', 'Milk', 'Milk')).toEqual([]);
    expect(fieldChange('price', '10.00', 10)).toEqual([]);
    expect(fieldChange('checked', false, true)).toEqual([
      { field: 'checked', from: false, to: true },
    ]);

    const sentence = auditUpdate(ada, 'item', 'item-1', [
      { field: 'name', from: 'Milk', to: 'Oat milk' },
      { field: 'checked', from: false, to: true },
    ]);

    expect(sentence).toBe(
      'User Ada (user-1) updated the item (item-1) field name from Milk to Oat milk. User Ada (user-1) updated the item (item-1) field checked from false to true.',
    );
  });

  it('uses unknown when the actor has no account', () => {
    expect(auditCreate({ id: null, name: 'unknown' }, 'item', 'item-1')).toBe(
      'User unknown (unknown) created the item (item-1).',
    );
  });

  it('prints empty for a blank previous value', () => {
    expect(auditUpdate(ada, 'list', 'list-1', [{ field: 'description', from: '', to: 'October' }])).toBe(
      'User Ada (user-1) updated the list (list-1) field description from empty to October.',
    );
  });
});
