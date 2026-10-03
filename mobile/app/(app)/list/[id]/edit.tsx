import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { CurrencyField } from '@/components/CurrencyField';
import { GhostButton, PrimaryButton, Screen, TextField, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { asParam } from '@/lib/params';

export default function EditListScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = asParam(idParam);
  const router = useRouter();
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ['list', id],
    queryFn: () => api.list(id!),
    enabled: Boolean(id),
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    if (listQuery.data) {
      setName(listQuery.data.name);
      setDescription(listQuery.data.description);
      setCurrency(listQuery.data.currency ?? 'BRL');
    }
  }, [listQuery.data]);

  const update = useMutation({
    mutationFn: () =>
      api.updateList(id!, {
        name: name.trim(),
        description: description.trim(),
        currency: currency ?? 'BRL',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['list', id] });
      await queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.back();
    },
    onError: (error: Error) => Alert.alert('Could not update list', error.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteList(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.replace('/(app)/(tabs)');
    },
    onError: (error: Error) => Alert.alert('Could not delete list', error.message),
  });

  return (
    <Screen variant="form">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Title>Edit list</Title>
        <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          autoCapitalize="sentences"
          multiline
        />
        <CurrencyField value={currency} onChange={setCurrency} />
        <PrimaryButton
          label="Save"
          onPress={() => update.mutate()}
          loading={update.isPending}
        />
        {listQuery.data?.role === 'owner' ? (
          <GhostButton
            danger
            label="Delete list"
            onPress={() =>
              Alert.alert('Delete list', 'This hides the list for everyone who has access.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
              ])
            }
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
