import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeFill } from '@/components/FadeFill';
import Colors, { COVER_COLORS } from '@/constants/Colors';
import { useLayout } from '@/components/layout';

export function useTheme() {
  return Colors.dark;
}

export function Screen({
  children,
  style,
  variant = 'page',
  inset = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'page' | 'form' | 'auth';
  inset?: boolean;
}) {
  const theme = useTheme();
  const { pad, height } = useLayout();
  const insets = useSafeAreaInsets();
  const maxWidth = variant === 'page' ? 1120 : 440;

  if (variant === 'auth') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.authScroll,
              {
                paddingHorizontal: pad,
                paddingTop: Math.max(insets.top + 24, (height - 640) / 3),
                paddingBottom: insets.bottom + 32,
              },
            ]}>
            <View style={[styles.column, { maxWidth }]}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.background,
          paddingTop: inset ? insets.top + 12 : 8,
        },
        style,
      ]}>
      <View style={[styles.column, styles.flex, { maxWidth, paddingHorizontal: pad }]}>
        {children}
      </View>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { compact } = useLayout();
  return (
    <Text style={[styles.title, { color: theme.text, fontSize: compact ? 32 : 40 }]}>
      {children}
    </Text>
  );
}

export function Body({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: theme.muted }]}>{children}</Text>;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { color: theme.text, backgroundColor: theme.input },
        ]}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  block = true,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        block ? styles.buttonBlock : styles.buttonInline,
        { overflow: 'hidden', opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
      ]}>
      <FadeFill colors={COVER_COLORS[0]} />
      {loading ? (
        <ActivityIndicator color={theme.onTint} style={styles.buttonContent} />
      ) : (
        <Text style={[styles.buttonLabel, styles.buttonContent, { color: theme.onTint }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.ghost,
        { opacity: pressed || hovered ? 0.7 : 1 },
      ]}>
      <Text style={[styles.ghostLabel, { color: danger ? theme.danger : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  emptyLabel = 'None',
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  function choose(next: string | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={[styles.field, open ? styles.fieldOpen : null]}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.input,
          styles.selectTrigger,
          { backgroundColor: pressed ? theme.elevated : theme.input },
        ]}>
        <Text style={{ color: selected ? theme.text : theme.muted, fontSize: 16, flex: 1 }}>
          {selected?.label ?? emptyLabel}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 12 }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={[styles.selectMenu, { backgroundColor: theme.elevated }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.selectScroll}>
            <Pressable
              onPress={() => choose(null)}
              style={({ pressed }) => [
                styles.selectOption,
                { backgroundColor: pressed || value === null ? theme.input : 'transparent' },
              ]}>
              <Text style={{ color: value === null ? theme.tint : theme.text, fontWeight: '700' }}>
                {emptyLabel}
              </Text>
            </Pressable>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option.value)}
                  style={({ pressed }) => [
                    styles.selectOption,
                    { backgroundColor: pressed || active ? theme.input : 'transparent' },
                  ]}>
                  <Text style={{ color: active ? theme.tint : theme.text, fontWeight: '700' }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.chip,
        {
          overflow: 'hidden',
          backgroundColor: active ? 'transparent' : pressed || hovered ? '#3E3E3E' : theme.elevated,
        },
      ]}>
      {active ? <FadeFill colors={COVER_COLORS[1]} /> : null}
      <Text style={[styles.chipLabel, styles.buttonContent, { color: active ? theme.onTint : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { height } = useLayout();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheetCard,
            { backgroundColor: theme.card, maxHeight: Math.min(height * 0.88, 720) },
          ]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  column: {
    width: '100%',
    alignSelf: 'center',
  },
  authScroll: {
    flexGrow: 1,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  fieldOpen: {
    zIndex: 2,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectMenu: {
    marginTop: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectScroll: {
    maxHeight: 240,
  },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonBlock: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  buttonInline: {
    alignSelf: 'flex-start',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonContent: {
    zIndex: 1,
  },
  ghost: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 16,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 12,
    padding: 20,
  },
});
