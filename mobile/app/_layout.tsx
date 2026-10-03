import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth-context';

export { ErrorBoundary } from 'expo-router';

const screenOptions = {
  headerShown: false,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#121212' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' as const, color: '#FFFFFF' },
  contentStyle: { backgroundColor: '#121212' },
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="join/[token]" options={{ headerShown: true, title: 'Shared list' }} />
          <Stack.Screen name="invite/[token]" options={{ headerShown: true, title: 'Invite' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
