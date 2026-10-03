import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Logo } from '@/components/Logo';
import { Body, GhostButton, PrimaryButton, Screen, TextField, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      await signUp(email.trim(), password, displayName.trim());
    } catch (error) {
      Alert.alert('Could not register', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen variant="auth">
      <Logo size={96} style={{ marginBottom: 16 }} />
      <Title>Create account</Title>
      <Body>
        Create an account to make your own grocery lists. Shared lists open from a link, no account
        needed.
      </Body>
      <TextField
        label="Name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="How others see you"
        autoCapitalize="words"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@email.com"
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry
      />
      <PrimaryButton label="Register" onPress={() => void onSubmit()} loading={loading} />
      <GhostButton label="I already have an account" onPress={() => router.push('/(auth)/login')} />
    </Screen>
  );
}
