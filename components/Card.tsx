import React from 'react';
import { View, ViewProps, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../lib/theme-context';
import { radius, spacing } from '../constants/theme';

type CardProps = ViewProps & { variant?: 'solid' | 'glass' };

export function Card({ style, children, variant = 'solid', ...rest }: CardProps) {
  const { colors, theme } = useAppTheme();

  const baseStyle = {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden' as const,
  };

  if (variant === 'glass') {
    // La versión web de BlurView no soporta un desenfoque real (limitación de
    // react-native-web), así que ahí usamos un fondo semitransparente como
    // aproximación. En iOS/Android sí es un blur de verdad.
    if (Platform.OS === 'web') {
      return (
        <View style={[baseStyle, { backgroundColor: colors.glass }, style]} {...rest}>
          {children}
        </View>
      );
    }
    return (
      <View style={[baseStyle, style]} {...rest}>
        <BlurView
          intensity={40}
          tint={theme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
        <View>{children}</View>
      </View>
    );
  }

  return (
    <View style={[baseStyle, { backgroundColor: colors.surface }, style]} {...rest}>
      {children}
    </View>
  );
}
