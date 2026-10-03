import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton } from '@/components/Icon';
import { ListEditor } from '@/components/ListEditor';
import { useTheme } from '@/components/ui';
import { api } from '@/lib/api';
import { asParam } from '@/lib/params';
import { useListRealtime } from '@/lib/use-list-realtime';

export default function JoinListScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string }>();
  const token = asParam(tokenParam);
  const router = useRouter();
  const theme = useTheme();

  const listQuery = useQuery({
    queryKey: ['shared', token],
    queryFn: () => api.sharedList(token!),
    enabled: Boolean(token),
  });

  const { presence, selfId } = useListRealtime({
    listId: listQuery.data?.id,
    shareToken: token,
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: listQuery.data?.name ?? 'Shared list',
          headerRight: () => (
            <IconButton
              name="exit"
              label="Exit"
              color={theme.text}
              onPress={() => router.replace('/')}
            />
          ),
        }}
      />
      <ListEditor
        listQuery={listQuery}
        queryKey={['shared', token]}
        presence={presence}
        selfId={selfId}
        onCreateItem={(values) => api.createSharedItem(token!, values)}
        onUpdateItem={(itemId, values) => api.updateSharedItem(token!, itemId, values)}
        onDeleteItem={(itemId) => api.deleteSharedItem(token!, itemId)}
      />
    </>
  );
}
