import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';
import { FadeFill } from '@/components/FadeFill';
import { coverColors } from '@/constants/Colors';
import { GroceryType } from '@/lib/types';

const TYPE_ICONS = {
  meat: { ios: 'flame.fill', android: 'outdoor_grill', web: 'outdoor_grill' },
  protein: { ios: 'oval.portrait.fill', android: 'egg_alt', web: 'egg_alt' },
  dairy: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  bakery: { ios: 'birthday.cake.fill', android: 'breakfast_dining', web: 'breakfast_dining' },
  fruits: { ios: 'leaf.fill', android: 'nutrition', web: 'nutrition' },
  vegetables: { ios: 'carrot.fill', android: 'grass', web: 'grass' },
  grains: { ios: 'takeoutbag.and.cup.and.straw.fill', android: 'rice_bowl', web: 'rice_bowl' },
  canned_foods: { ios: 'archivebox.fill', android: 'inventory_2', web: 'inventory_2' },
  condiments: { ios: 'waterbottle.fill', android: 'soup_kitchen', web: 'soup_kitchen' },
  snacks: { ios: 'popcorn.fill', android: 'cookie', web: 'cookie' },
  beverages: { ios: 'cup.and.saucer.fill', android: 'local_cafe', web: 'local_cafe' },
  household: { ios: 'house.fill', android: 'cleaning_services', web: 'cleaning_services' },
  personal_care: { ios: 'hands.sparkles.fill', android: 'soap', web: 'soap' },
  other: { ios: 'square.grid.2x2.fill', android: 'category', web: 'category' },
} as const;

export function GroceryMark({
  name,
  type,
  seed,
}: {
  name: string;
  type?: GroceryType | null;
  seed: string;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  const icon = type ? TYPE_ICONS[type.code as keyof typeof TYPE_ICONS] : undefined;

  return (
    <View
      accessibilityLabel={type ? type.name : letter}
      style={{
        width: 48,
        height: 48,
        borderRadius: 4,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <FadeFill colors={coverColors(type?.code ?? seed)} />
      {icon ? (
        <View style={{ zIndex: 1 }}>
          <SymbolView name={icon} tintColor="#fff" size={26} fallback={<Letter letter={letter} />} />
        </View>
      ) : (
        <Letter letter={letter} />
      )}
    </View>
  );
}

function Letter({ letter }: { letter: string }) {
  return <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, zIndex: 1 }}>{letter}</Text>;
}
