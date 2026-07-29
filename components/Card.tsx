import React from 'react';
import { View, ViewProps } from 'react-native';
import { useAppTheme } from '../lib/theme-context';
import { radius, spacing } from '../constants/theme';

export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.md,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
