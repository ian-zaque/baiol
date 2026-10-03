import { Redirect, useLocalSearchParams } from 'expo-router';
import { asParam } from '@/lib/params';

export default function InviteRedirectScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string }>();
  const token = asParam(tokenParam);
  if (!token) {
    return <Redirect href="/" />;
  }
  return <Redirect href={`/join/${token}`} />;
}
