import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';

export function CreateMesoChooser({
  onFromScratch,
  onCancel,
}: {
  onFromScratch: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();

  const options: { id: string; label: string; desc: string; icon: keyof typeof Feather.glyphMap; available: boolean; onPress?: () => void }[] = [
    {
      id: 'scratch',
      label: 'Start from scratch',
      desc: 'Pick your days and exercises yourself',
      icon: 'edit-3',
      available: true,
      onPress: onFromScratch,
    },
    {
      id: 'template',
      label: 'Use a template',
      desc: 'Start from a saved or built-in routine',
      icon: 'copy',
      available: false,
    },
    {
      id: 'ai',
      label: 'Build it with AI chat',
      desc: 'Describe your goal, answer a few questions, get a mesocycle',
      icon: 'message-circle',
      available: false,
    },
  ];

  return (
    <View>
      <Pressable onPress={onCancel} style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.text2 }}>✕ Cancel</Text>
      </Pressable>
      <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 14 }}>How do you want to build this mesocycle?</Text>
      {options.map((o) => (
        <Pressable
          key={o.id}
          disabled={!o.available}
          onPress={o.onPress}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            opacity: o.available ? 1 : 0.55,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={o.icon} size={20} color={o.available ? colors.accent : colors.text2} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{o.label}</Text>
              {!o.available && (
                <View style={{ backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>COMING SOON</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{o.desc}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
