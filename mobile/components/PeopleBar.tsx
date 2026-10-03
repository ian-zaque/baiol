import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FadeFill } from '@/components/FadeFill';
import { useTheme } from '@/components/ui';
import { coverColors } from '@/constants/Colors';
import { PresenceUser, PublicMember } from '@/lib/types';

export function PeopleBar({
  members,
  presence,
  selfId,
}: {
  members: PublicMember[];
  presence: PresenceUser[];
  selfId?: string | null;
}) {
  const theme = useTheme();
  const online = presence.filter((user) => user.display_name.trim());
  const others = online.filter((user) => user.id !== selfId);
  const me = online.find((user) => user.id === selfId);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.text }]}>
        {others.length === 0
          ? 'No one else is here'
          : others.length === 1
            ? '1 other person is here'
            : `${others.length} other people are here`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {me ? <Avatar name={me.display_name} label="You" self /> : null}
        {others.map((user) => (
          <Avatar key={user.id} name={user.display_name} />
        ))}
        {others.length === 0 && !me ? (
          <Text style={[styles.empty, { color: theme.muted }]}>You are the only one in this list.</Text>
        ) : null}
      </ScrollView>
      {others.length === 0 && me ? (
        <Text style={[styles.empty, { color: theme.muted }]}>You are the only one in this list.</Text>
      ) : null}
      {members.length > 0 ? (
        <Text style={[styles.access, { color: theme.muted }]}>
          {members.length} with access
        </Text>
      ) : null}
    </View>
  );
}

function Avatar({ name, label, self }: { name: string; label?: string; self?: boolean }) {
  const theme = useTheme();
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.person}>
      <View
        style={[
          styles.circle,
          {
            overflow: 'hidden',
            backgroundColor: self ? theme.elevated : 'transparent',
            borderColor: self ? theme.muted : 'transparent',
          },
        ]}>
        {self ? null : <FadeFill colors={coverColors(name)} />}
        <Text style={[styles.letter, { color: self ? theme.text : theme.onTint, zIndex: 1 }]}>{letter}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
        {label ?? name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingRight: 8,
  },
  person: {
    width: 72,
    alignItems: 'center',
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 20,
    fontWeight: '800',
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  access: {
    fontSize: 12,
    marginTop: 10,
  },
});
