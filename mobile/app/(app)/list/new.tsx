import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { CurrencyField } from '@/components/CurrencyField';
import { PrimaryButton, Screen, TextField, Title } from '@/components/ui';
import { api } from '@/lib/api';

export default function NewListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onCreate() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this list a name.');
      return;
    }
    try {
      setLoading(true);
      const list = await api.createList({
        name: name.trim(),
        description: description.trim(),
        ...(currency ? { currency } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.replace(`/(app)/list/${list.id}`);
    } catch (error) {
      Alert.alert('Could not create list', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen variant="form">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Title>New grocery list</Title>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="October groceries"
          autoCapitalize="sentences"
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
          autoCapitalize="sentences"
          multiline
        />
        <CurrencyField value={currency} onChange={setCurrency} />
        <PrimaryButton label="Create list" onPress={() => void onCreate()} loading={loading} />
      </ScrollView>
    </Screen>
  );
}
