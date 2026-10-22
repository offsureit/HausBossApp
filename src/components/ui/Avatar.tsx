import { StyleSheet, View } from 'react-native';
import { getContractorColor, getContrastText } from '@/utils/contractorColors';
import { initials } from '@/utils/names';
import { Text } from './Text';

export interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  /** Used for the identity colour when no `color` override exists. */
  name: string;
  color?: string | null;
  size?: number;
}

/** Initials on the employee's identity colour (`getContractorColor`). */
export function Avatar({ firstName, lastName, name, color, size = 40 }: AvatarProps) {
  const bg = getContractorColor(name, color);
  const letters = initials({ firstName, lastName }) || name.slice(0, 2).toUpperCase();
  return (
    <View accessibilityLabel={name} style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text variant={size >= 48 ? 'heading' : 'label'} color={getContrastText(bg)}>{letters}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ circle: { alignItems: 'center', justifyContent: 'center' } });
