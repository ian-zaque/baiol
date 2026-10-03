import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLayout } from '@/components/layout';
import { Body, PrimaryButton, Screen, Title, useTheme } from '@/components/ui';
import { FadeFill } from '@/components/FadeFill';
import { coverColors } from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicList } from '@/lib/types';

export default function ListsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { compact, columns, content } = useLayout();
  const { profile } = useAuth();
  const lists = useQuery({
    queryKey: ['lists'],
    queryFn: api.lists,
  });
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  return (
    <Screen inset>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <View
          style={{
            flexDirection: compact ? 'column' : 'row',
            alignItems: compact ? 'flex-start' : 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 8,
          }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.muted, fontWeight: '700', marginBottom: 6 }}>Baiol Library</Text>
            <Title>{firstName ? `Hey, ${firstName}` : 'Your lists'}</Title>
          </View>
          <PrimaryButton
            label="New list"
            block={false}
            onPress={() => router.push('/(app)/list/new')}
          />
        </View>
        <Body>Create a monthly list and share it. People you add will just see it in their lists.</Body>
        {lists.isLoading ? (
          <ActivityIndicator color={theme.tint} style={{ marginTop: 24 }} />
        ) : (lists.data ?? []).length === 0 ? (
          <Body>No lists yet. Start with this month's groceries.</Body>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {(lists.data ?? []).map((list) => (
              <View
                key={list.id}
                style={{ width: (content - 16 * (columns - 1)) / columns }}>
                <ListCard list={list} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ListCard({ list }: { list: PublicList }) {
  const router = useRouter();
  const theme = useTheme();
  const { compact } = useLayout();
  const count = list.item_count ?? list.items.length;
  const role = list.role === 'owner' ? 'Owner' : 'Shared';

  if (compact) {
    return (
      <Pressable
        onPress={() => router.push(`/(app)/list/${list.id}`)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: pressed ? theme.elevated : theme.card,
          borderRadius: 8,
          padding: 10,
        })}>
        <Cover id={list.id} name={list.name} size={64} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
            {list.name}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.muted, marginTop: 4 }}>
            {count} items · {role}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/(app)/list/${list.id}`)}
      style={({ pressed, hovered }) => ({
        backgroundColor: pressed || hovered ? theme.elevated : theme.card,
        borderRadius: 8,
        padding: 16,
      })}>
        <Cover id={list.id} name={list.name} />
      <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 14 }}>
        {list.name}
      </Text>
      <Text numberOfLines={2} style={{ color: theme.muted, marginTop: 4, minHeight: 40 }}>
        {list.description || `${count} items · ${role}`}
      </Text>
    </Pressable>
  );
}

function Cover({ id, name, size }: { id: string; name: string; size?: number }) {
  const letter = name.trim().charAt(0).toUpperCase() || 'B';
  return (
    <View
      style={{
        width: size ?? '100%',
        aspectRatio: 1,
        borderRadius: 4,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <FadeFill colors={coverColors(id)} />
      <Text style={{ color: '#fff', fontSize: size ? 26 : 48, fontWeight: '800', zIndex: 1 }}>{letter}</Text>
    </View>
  );
}
