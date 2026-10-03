import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Sheet, useTheme } from '@/components/ui';
import { CURRENCIES, currencyOf } from '@/lib/money';

export function CurrencyField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = value ? currencyOf(value) : null;
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CURRENCIES;
    return CURRENCIES.filter((currency) =>
      `${currency.code} ${currency.name} ${currency.symbol}`.toLowerCase().includes(needle),
    );
  }, [query]);

  function choose(code: string | null) {
    onChange(code);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
        Currency
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.elevated : theme.input,
          borderRadius: 4,
          paddingHorizontal: 14,
          paddingVertical: 14,
        })}>
        <Text style={{ color: selected ? theme.text : theme.muted, fontSize: 16 }}>
          {selected ? `${selected.name} (${selected.symbol})` : 'Optional · defaults to R$'}
        </Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800', marginBottom: 14 }}>
          Currency
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search currencies"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          style={{
            backgroundColor: theme.input,
            color: theme.text,
            borderRadius: 4,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            marginBottom: 8,
          }}
        />
        <Pressable onPress={() => choose(null)} style={{ paddingVertical: 12 }}>
          <Text style={{ color: theme.tint, fontWeight: '800' }}>Use default (R$)</Text>
        </Pressable>
        <FlatList
          data={options}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 320 }}
          renderItem={({ item }) => {
            const active = item.code === value;
            return (
              <Pressable
                onPress={() => choose(item.code)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                  backgroundColor: pressed || active ? theme.elevated : 'transparent',
                })}>
                <Text style={{ color: active ? theme.tint : theme.text, fontWeight: '700' }}>
                  {item.symbol} · {item.name}
                </Text>
                <Text style={{ color: theme.muted, marginTop: 2 }}>{item.code}</Text>
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}
