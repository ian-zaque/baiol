import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/components/ui';

export default function Index() {
  const { loading, session } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return <Redirect href={session ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
