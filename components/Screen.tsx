import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../lib/theme-context';
import { spacing } from '../constants/theme';

// Vuelve a la pantalla única (Today) — antes no hacía falta porque había
// pestañas; ahora es la única forma de volver desde Training/Nutrition/
// Progress (ver docs/SIMPLIFIED_VISION.md).
export function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={12}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="arrow-left" size={18} color={colors.text} />
          </Pressable>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            {title}
          </Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
