import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '../theme/tokens';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        pressed && styles.pressed,
        pressed && variant === 'secondary' && styles.secondaryPressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.45 },
  label: { color: colors.white, fontSize: 17, fontWeight: '700' },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE2D2',
  },
  secondaryPressed: { backgroundColor: '#E9EEDF' },
  secondaryLabel: { color: '#657553', fontSize: 15, fontWeight: '600' },
});
