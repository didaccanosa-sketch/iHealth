import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';

export function CreateMesoChooser({
  onFromScratch,
  onUseTemplate,
  onRecommend,
  recommending,
  onCancel,
}: {
  onFromScratch: () => void;
  onUseTemplate: () => void;
  onRecommend: () => void;
  recommending?: boolean;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();

  const options: { id: string; label: string; desc: string; icon: keyof typeof Feather.glyphMap; available: boolean; onPress?: () => void; loading?: boolean }[] = [
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
      desc: 'Built-in splits, your saved templates, or a focused split',
      icon: 'copy',
      available: true,
      onPress: onUseTemplate,
    },
    {
      id: 'recommend',
      label: 'Recommend for me',
      desc: 'Uses your goal to propose frequency, phase and level — you review before it gets created',
      icon: 'zap',
      available: true,
      onPress: onRecommend,
      loading: recommending,
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
          disabled={!o.available || o.loading}
          onPress={o.onPress}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            opacity: !o.available || o.loading ? 0.55 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            {o.loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Feather name={o.icon} size={20} color={o.available ? colors.accent : colors.text2} />
            )}
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
