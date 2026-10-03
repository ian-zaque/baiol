import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { FadeFill } from '@/components/FadeFill';
import { Body, GhostButton, PrimaryButton, Screen, TextField, Title, useTheme } from '@/components/ui';
import { COVER_COLORS } from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AccountScreen() {
  const theme = useTheme();
  const { profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const letter = (profile?.display_name || profile?.email || 'B').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile?.display_name]);

  async function onSave() {
    try {
      setSaving(true);
      await api.updateMe(displayName.trim());
      await refreshProfile();
      Alert.alert('Saved', 'Your name was updated.');
    } catch (error) {
      Alert.alert('Could not save', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen variant="form" inset>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
          <FadeFill colors={COVER_COLORS[0]} />
          <Text style={{ color: theme.onTint, fontSize: 36, fontWeight: '800', zIndex: 1 }}>{letter}</Text>
        </View>
        <Title>Account</Title>
        <Body>{profile?.email}</Body>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <PrimaryButton label="Save name" onPress={() => void onSave()} loading={saving} />
        <GhostButton label="Log out" onPress={() => void signOut()} danger />
      </ScrollView>
    </Screen>
  );
}
