import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useLayout } from '@/components/layout';
import { useTheme } from '@/components/ui';

export default function TabLayout() {
  const theme = useTheme();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: wide
          ? { display: 'none' }
          : {
              backgroundColor: theme.sidebar,
              borderTopColor: theme.border,
              height: 58 + insets.bottom,
              paddingBottom: insets.bottom,
              paddingTop: 6,
            },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color }) => <Icon name="lists" color={color} size={26} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <Icon name="account" color={color} size={26} />,
        }}
      />
    </Tabs>
  );
}
