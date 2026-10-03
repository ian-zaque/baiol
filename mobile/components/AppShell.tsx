import { useQuery } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { FadeFill } from '@/components/FadeFill';
import { Icon, IconButton } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { SidebarProvider, SIDEBAR_WIDTH, useLayout } from '@/components/layout';
import { useTheme } from '@/components/ui';
import { COVER_COLORS, coverMid } from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicList } from '@/lib/types';

const COLLAPSED_WIDTH = 80;
const COVER = 48;
const GUTTER = 8;

export function AppShell({ children }: { children: ReactNode }) {
  const { wide } = useLayout();
  const [collapsed, setCollapsed] = useState(false);
  if (!wide) {
    return (
      <SidebarProvider width={0}>
        <View style={{ flex: 1 }}>{children}</View>
      </SidebarProvider>
    );
  }
  const panel = collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  return (
    <SidebarProvider width={panel + GUTTER * 2}>
      <DesktopShell
        collapsed={collapsed}
        panel={panel}
        onToggle={() => setCollapsed((current) => !current)}>
        {children}
      </DesktopShell>
    </SidebarProvider>
  );
}

function DesktopShell({
  children,
  collapsed,
  panel,
  onToggle,
}: {
  children: ReactNode;
  collapsed: boolean;
  panel: number;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const rows = lists.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.sidebar }}>
      <View
        style={{
          height: 64,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Logo size={32} />
        <AccountMark />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', padding: GUTTER, paddingTop: 0, gap: GUTTER }}>
        <View
          style={{
            width: panel,
            backgroundColor: theme.background,
            borderRadius: 8,
            overflow: 'hidden',
            paddingTop: 8,
            paddingBottom: 8,
            paddingHorizontal: collapsed ? 0 : 8,
          }}>
          {collapsed ? (
            <View style={{ alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <IconButton
                name="library"
                label="Expand sidebar"
                color={theme.text}
                onPress={onToggle}
              />
              <CircleButton label="New list" onPress={() => router.push('/(app)/list/new')} />
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 8,
                paddingVertical: 4,
                marginBottom: 8,
              }}>
              <Icon name="library" color={theme.text} size={24} />
              <Pressable
                onPress={() => router.push('/(app)/(tabs)')}
                style={{ flex: 1 }}
                accessibilityLabel="Your lists">
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>Your lists</Text>
              </Pressable>
              <CircleButton label="New list" onPress={() => router.push('/(app)/list/new')} />
              <IconButton
                name="collapse"
                label="Collapse sidebar"
                color={theme.text}
                size={20}
                onPress={onToggle}
              />
            </View>
          )}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              gap: collapsed ? 8 : 4,
              alignItems: collapsed ? 'center' : 'stretch',
              paddingBottom: 8,
            }}
            showsVerticalScrollIndicator={false}>
            {rows.length === 0 ? (
              collapsed ? null : (
                <Text style={{ color: theme.muted, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 }}>
                  {lists.isLoading ? 'Loading…' : 'No lists yet'}
                </Text>
              )
            ) : (
              rows.map((list) => (
                <ListRow
                  key={list.id}
                  list={list}
                  collapsed={collapsed}
                  active={pathname.includes(list.id)}
                  onPress={() => router.push(`/(app)/list/${list.id}`)}
                />
              ))
            )}
          </ScrollView>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.background,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
          {children}
        </View>
      </View>
    </View>
  );
}

function ListRow({
  list,
  collapsed,
  active,
  onPress,
}: {
  list: PublicList;
  collapsed: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const count = list.item_count ?? list.items.length;
  const role = list.role === 'editor' ? 'Shared' : 'Owner';
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={list.name}
      style={({ hovered, pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 6,
          padding: collapsed ? 0 : 8,
          backgroundColor: !collapsed && (active || hovered || pressed) ? theme.elevated : 'transparent',
        },
      ]}>
      <Cover letter={list.name.trim().charAt(0).toUpperCase() || 'B'} color={coverMid(list.id)} />
      {collapsed ? null : (
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
            {list.name}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
            {role} · {count} {count === 1 ? 'item' : 'items'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Cover({ letter, color }: { letter: string; color: string }) {
  return (
    <View
      style={{
        width: COVER,
        height: COVER,
        borderRadius: 4,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{letter}</Text>
    </View>
  );
}

function CircleButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered, pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hovered || pressed ? '#3E3E3E' : theme.elevated,
      })}>
      <Icon name="add" color={theme.text} size={18} />
    </Pressable>
  );
}

function AccountMark() {
  const theme = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname.includes('account');
  const letter = (profile?.display_name || profile?.email || 'A').trim().charAt(0).toUpperCase();
  return (
    <Pressable
      onPress={() => router.push('/(app)/(tabs)/account')}
      accessibilityLabel="Account"
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: active ? 2 : 0,
        borderColor: theme.text,
      }}>
      <FadeFill colors={COVER_COLORS[0]} />
      <Text style={{ color: '#fff', fontWeight: '800', zIndex: 1 }}>{letter}</Text>
    </Pressable>
  );
}
