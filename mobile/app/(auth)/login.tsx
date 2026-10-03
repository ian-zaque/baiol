import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Logo } from '@/components/Logo';
import { Body, GhostButton, PrimaryButton, Screen, TextField, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      await signIn(email.trim(), password);
    } catch (error) {
      Alert.alert('Could not sign in', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen variant="auth">
      <Logo size={96} style={{ marginBottom: 16 }} />
      <Title>Baiol</Title>
      <Body>Monthly grocery lists you can share with the people who shop with you.</Body>
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
        placeholder="Your password"
        secureTextEntry
      />
      <PrimaryButton label="Log in" onPress={() => void onSubmit()} loading={loading} />
      <GhostButton label="Create an account" onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}
