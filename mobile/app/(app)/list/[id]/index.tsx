import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { IconButton } from '@/components/Icon';
import { ListEditor } from '@/components/ListEditor';
import { useTheme } from '@/components/ui';
import { api } from '@/lib/api';
import { asParam } from '@/lib/params';
import { useListRealtime } from '@/lib/use-list-realtime';

export default function ListDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = asParam(idParam);
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { presence, selfId } = useListRealtime({ listId: id });

  const listQuery = useQuery({
    queryKey: ['list', id],
    queryFn: () => api.list(id!),
    enabled: Boolean(id),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: listQuery.data?.name ?? 'List',
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 4 }}>
          <IconButton
            name="share"
            label="Share"
            color={theme.text}
            onPress={() => router.push(`/(app)/list/${id}/share`)}
          />
          <IconButton
            name="edit"
            label="Edit list"
            color={theme.text}
            onPress={() => router.push(`/(app)/list/${id}/edit`)}
          />
        </View>
      ),
    });
  }, [id, listQuery.data?.name, navigation, router, theme.text]);

  return (
    <ListEditor
      listQuery={listQuery}
      queryKey={['list', id]}
      presence={presence}
      selfId={selfId}
      onCreateItem={(values) => api.createItem(id!, values)}
      onUpdateItem={(itemId, values) => api.updateItem(id!, itemId, values)}
      onDeleteItem={(itemId) => api.deleteItem(id!, itemId)}
    />
  );
}
