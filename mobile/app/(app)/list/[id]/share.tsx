import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text } from 'react-native';
import {
  Body,
  Card,
  GhostButton,
  PrimaryButton,
  Screen,
  Title,
  useTheme,
} from '@/components/ui';
import { api } from '@/lib/api';
import { asParam } from '@/lib/params';

export default function ShareListScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = asParam(idParam);
  const theme = useTheme();

  const share = useQuery({
    queryKey: ['share', id],
    queryFn: () => api.shareLink(id!),
    enabled: Boolean(id),
  });

  const rotate = useMutation({
    mutationFn: () => api.rotateShareLink(id!),
    onSuccess: () => {
      void share.refetch();
      Alert.alert('Link reset', 'The old link no longer works.');
    },
    onError: (error: Error) => Alert.alert('Could not reset link', error.message),
  });

  async function copy(value: string) {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', 'Anyone with this link can open and edit the list.');
  }

  const appLink = share.data?.app_link ?? '';
  const webLink = share.data?.web_link ?? '';

  return (
    <Screen variant="form">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Title>Share this list</Title>
        <Body>
          Copy the link and send it however you like. The other person does not need an account.
        </Body>
        <Card>
          <Text style={{ fontWeight: '700', color: theme.muted, marginBottom: 8, fontSize: 12 }}>
            APP LINK
          </Text>
          <Text selectable style={{ color: theme.text, fontSize: 15 }}>
            {appLink || 'Loading…'}
          </Text>
        </Card>
        <PrimaryButton
          label="Copy link"
          onPress={() => void copy(appLink || webLink)}
          disabled={!appLink && !webLink}
        />
        {webLink ? (
          <>
            <Card>
              <Text style={{ fontWeight: '700', color: theme.muted, marginBottom: 8, fontSize: 12 }}>
                WEB LINK
              </Text>
              <Text selectable style={{ color: theme.text, fontSize: 15 }}>
                {webLink}
              </Text>
            </Card>
            <GhostButton label="Copy web link" onPress={() => void copy(webLink)} />
          </>
        ) : null}
        <GhostButton
          danger
          label="Reset link"
          onPress={() =>
            Alert.alert('Reset share link?', 'People with the old link will lose access.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => rotate.mutate() },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}
