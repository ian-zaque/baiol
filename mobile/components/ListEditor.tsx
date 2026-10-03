import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { GroceryMark } from '@/components/GroceryMark';
import { Icon, IconButton } from '@/components/Icon';
import { useLayout } from '@/components/layout';
import { PeopleBar } from '@/components/PeopleBar';
import {
  Body,
  Chip,
  GhostButton,
  PrimaryButton,
  Screen,
  SelectField,
  Sheet,
  TextField,
  Title,
  useTheme,
} from '@/components/ui';
import { api } from '@/lib/api';
import { sortItemsByChecked } from '@/lib/item-order';
import { formatPrice, maskPrice, parsePrice } from '@/lib/money';
import { GroceryType, PublicItem, PublicList } from '@/lib/types';

type ItemValues = {
  name: string;
  description: string;
  amount: string;
  price: number;
  grocery_type_id: string | null;
  checked?: boolean;
};

type ListRow =
  | { kind: 'header'; id: string; title: string }
  | { kind: 'item'; item: PublicItem };

function rowsFor(items: PublicItem[], grouped: boolean): ListRow[] {
  if (!grouped) {
    return sortItemsByChecked(items).map((item) => ({ kind: 'item', item }));
  }

  const buckets = new Map<
    string,
    { id: string; title: string; sort: number; items: PublicItem[] }
  >();
  for (const item of items) {
    const type = item.grocery_type;
    const id = type?.id ?? 'none';
    const bucket = buckets.get(id) ?? {
      id,
      title: type?.name ?? 'No type',
      sort: type?.sort_order ?? 10_000,
      items: [],
    };
    bucket.items.push(item);
    buckets.set(id, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
    .flatMap((bucket) => [
      { kind: 'header' as const, id: `header-${bucket.id}`, title: bucket.title },
      ...sortItemsByChecked(bucket.items).map((item) => ({ kind: 'item' as const, item })),
    ]);
}

export function ListEditor({
  listQuery,
  queryKey,
  presence,
  selfId,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}: {
  listQuery: {
    isLoading: boolean;
    error: unknown;
    data?: PublicList;
  };
  queryKey: unknown[];
  presence: { id: string; email: string; display_name: string }[];
  selfId?: string | null;
  onCreateItem: (values: ItemValues) => Promise<unknown>;
  onUpdateItem: (itemId: string, values: ItemValues) => Promise<unknown>;
  onDeleteItem: (itemId: string) => Promise<unknown>;
}) {
  const theme = useTheme();
  const { columns, content } = useLayout();
  const [editingItem, setEditingItem] = useState<PublicItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PublicItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const queryClient = useQueryClient();
  const typesQuery = useQuery({
    queryKey: ['grocery-types'],
    queryFn: api.groceryTypes,
  });

  const deleteItem = useMutation({
    mutationFn: onDeleteItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  async function toggleChecked(item: PublicItem) {
    try {
      await onUpdateItem(item.id, {
        name: item.name,
        description: item.description,
        amount: item.amount,
        price: Number(item.price),
        grocery_type_id: item.grocery_type?.id ?? null,
        checked: !item.checked,
      });
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      Alert.alert('Could not update item', (error as Error).message);
    }
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    try {
      await deleteItem.mutateAsync(itemToDelete.id);
      setItemToDelete(null);
    } catch (error) {
      Alert.alert('Could not remove item', (error as Error).message);
    }
  }

  if (listQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.tint} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (listQuery.error || !listQuery.data) {
    return (
      <Screen variant="form">
        <Title>List unavailable</Title>
        <Body>
          {(listQuery.error as Error | undefined)?.message ??
            'This list could not be opened.'}
        </Body>
      </Screen>
    );
  }

  const list = listQuery.data;
  const itemCount = list.items.length;
  const currency = list.currency;
  const totalValue = list.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const rows = rowsFor(list.items, grouped);
  const itemColumns = grouped ? 1 : columns;
  const itemGap = 12;
  const itemWidth = grouped ? content : (content - itemGap * (itemColumns - 1)) / itemColumns;

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled">
        {list.description ? <Body>{list.description}</Body> : null}
        <PeopleBar members={list.members ?? []} presence={presence} selfId={selfId} />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <Stat label="Items" value={String(itemCount)} />
          <Stat label="Total" value={formatPrice(totalValue, currency)} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}>
          <PrimaryButton label="Add item" block={false} onPress={() => setCreating(true)} />
          <Chip
            label={grouped ? 'Show as one list' : 'Group by type'}
            active={grouped}
            onPress={() => setGrouped((current) => !current)}
          />
        </View>
        {rows.length === 0 ? (
          <Body>No items yet. Add rice, milk, or whatever this month needs.</Body>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grouped ? 8 : itemGap }}>
            {rows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <View key={row.id} style={{ width: '100%', marginTop: 12 }}>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: theme.elevated,
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                        {row.title}
                      </Text>
                    </View>
                  </View>
                );
              }
              return (
                <View key={row.item.id} style={{ width: itemWidth }}>
                  <ItemRow
                    item={row.item}
                    currency={currency}
                    showType={!grouped}
                    onToggle={() => void toggleChecked(row.item)}
                    onEdit={() => setEditingItem(row.item)}
                    onDelete={() => setItemToDelete(row.item)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <ItemModal
        visible={creating}
        title="Add item"
        currency={currency}
        types={typesQuery.data ?? []}
        onClose={() => setCreating(false)}
        onSave={async (values) => {
          await onCreateItem(values);
          await queryClient.invalidateQueries({ queryKey });
          setCreating(false);
        }}
      />
      <Sheet visible={Boolean(itemToDelete)} onClose={() => setItemToDelete(null)}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Delete item</Text>
        <Text style={{ color: theme.muted, marginTop: 8, marginBottom: 16, fontSize: 16 }}>
          Remove {itemToDelete?.name} from this list?
        </Text>
        <Pressable
          onPress={() => void confirmDelete()}
          disabled={deleteItem.isPending}
          style={{
            backgroundColor: theme.danger,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: deleteItem.isPending ? 0.7 : 1,
          }}>
          {deleteItem.isPending ? (
            <ActivityIndicator color={theme.onTint} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="delete" color={theme.onTint} size={18} />
              <Text style={{ color: theme.onTint, fontWeight: '800' }}>Delete</Text>
            </View>
          )}
        </Pressable>
        <GhostButton label="Cancel" onPress={() => setItemToDelete(null)} />
      </Sheet>
      <ItemModal
        visible={Boolean(editingItem)}
        title="Update item"
        currency={currency}
        types={typesQuery.data ?? []}
        item={editingItem ?? undefined}
        onClose={() => setEditingItem(null)}
        onSave={async (values) => {
          if (!editingItem) return;
          await onUpdateItem(editingItem.id, values);
          await queryClient.invalidateQueries({ queryKey });
          setEditingItem(null);
        }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: 8, padding: 16, minWidth: 0 }}>
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginTop: 6 }}>
        {value}
      </Text>
    </View>
  );
}

function ItemRow({
  item,
  currency,
  showType,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: PublicItem;
  currency?: string;
  showType: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const checked = Boolean(item.checked);
  const meta = [item.amount, showType ? item.grocery_type?.name : null, item.description]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.card,
        borderRadius: 8,
        paddingVertical: 10,
        paddingLeft: 10,
        paddingRight: 4,
        opacity: checked ? 0.72 : 1,
      }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={checked ? `Mark ${item.name} as still needed` : `Mark ${item.name} as bought`}
        hitSlop={8}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? theme.tint : theme.muted,
          backgroundColor: checked ? theme.tint : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? <Icon name="check" color={theme.onTint} size={16} /> : null}
      </Pressable>
      <GroceryMark name={item.name} type={item.grocery_type} seed={item.id} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: checked ? theme.muted : theme.text,
            fontSize: 16,
            fontWeight: '700',
            textDecorationLine: checked ? 'line-through' : 'none',
          }}>
          {item.name}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={{ color: theme.muted, marginTop: 2, fontSize: 13 }}>
            {meta}
          </Text>
        ) : null}
        <Text style={{ color: checked ? theme.muted : theme.text, marginTop: 4, fontWeight: '700' }}>
          {formatPrice(Number(item.price), currency)}
        </Text>
      </View>
      <IconButton name="edit" label={`Edit ${item.name}`} color={theme.text} onPress={onEdit} />
      <IconButton name="delete" label={`Delete ${item.name}`} color={theme.danger} onPress={onDelete} />
    </View>
  );
}

function ItemModal({
  visible,
  title,
  currency,
  types,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  currency?: string;
  types: GroceryType[];
  item?: PublicItem;
  onClose: () => void;
  onSave: (values: ItemValues) => Promise<void>;
}) {
  const { height } = useLayout();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [groceryTypeId, setGroceryTypeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setAmount(item?.amount ?? '');
    setPrice(formatPrice(item ? Number(item.price) : 0, currency));
    setGroceryTypeId(item?.grocery_type?.id ?? null);
  }, [currency, item, visible]);

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        amount: amount.trim(),
        price: parsePrice(price, currency),
        grocery_type_id: groceryTypeId,
      });
    } catch (error) {
      Alert.alert('Could not save item', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.72 }}>
        <Title>{title}</Title>
        <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" />
        <SelectField
          label="Type"
          value={groceryTypeId}
          onChange={setGroceryTypeId}
          emptyLabel="No type"
          options={types.map((type) => ({ value: type.id, label: type.name }))}
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          autoCapitalize="sentences"
          multiline
        />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="2 kg, 1 pack..."
        />
        <TextField
          label="Price"
          value={price}
          onChangeText={(value) => setPrice(maskPrice(value, currency))}
          keyboardType="decimal-pad"
          placeholder={formatPrice(0, currency)}
        />
        <PrimaryButton label="Save" onPress={() => void submit()} loading={saving} />
        <GhostButton label="Cancel" onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}
