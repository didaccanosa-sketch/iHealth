import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { spacing } from '../../constants/theme';
import { fetchProfile } from '../../lib/data/profile';
import { GoalSummaryCard } from '../../components/goal/GoalSummaryCard';
import { TrackingCard } from '../../components/tracking/TrackingCard';
import { useGoalEvaluation } from '../../components/goal/useGoalEvaluation';
import { getStrategyRecommendationWithAdjustment } from '../../lib/data/recommendation';
import { StrategyPlan, STATS_FOCUS_BY_GOAL } from '../../lib/engine/recommendation-engine';
import { sendChatMessage } from '../../lib/data/chat';

// Pantalla única (ver docs/SIMPLIFIED_VISION.md): cabecera + stats + chat.
// El chat (v1) responde preguntas y ya registra peso/comida con una
// interpretación básica — ver lib/data/chat.ts y
// supabase/functions/chat-assistant. Entreno todavía no se puede registrar
// desde aquí (se avisa en el propio chat).

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 19) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id as string;

  const [name, setName] = useState<string | null>(null);
  const [plan, setPlan] = useState<StrategyPlan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { goalType, refresh: refreshGoal } = useGoalEvaluation(userId);

  const load = useCallback(async () => {
    const profile = await fetchProfile(userId).catch(() => null);
    setName(profile?.name || null);
    const result = await getStrategyRecommendationWithAdjustment(userId).catch(() => null);
    setPlan(result?.plan ?? null);
    // Bucle de adherencia (ver docs/SIMPLIFIED_VISION.md): si el motor acaba
    // de reajustar las calorías solo, se avisa como mensaje del asistente en
    // vez de en silencio — nunca dos veces la misma razón en la conversación.
    if (result?.adjustmentReason) {
      setMessages((prev) =>
        prev.some((m) => m.text === result.adjustmentReason)
          ? prev
          : [...prev, { id: `adj-${Date.now()}`, role: 'assistant', text: result.adjustmentReason as string }]
      );
    }
  }, [userId]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
    setSending(true);
    try {
      const result = await sendChatMessage(userId, text);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: result.reply }]);
      // Un registro (peso/comida) puede haber cambiado el objetivo/plan —
      // refrescamos la franja de stats para que se note sin recargar.
      load();
      refreshGoal();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: 'No he podido responder — inténtalo de nuevo en un momento.' },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [draft, sending, userId, load, refreshGoal]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const initial = (name || session?.user.email || '?').trim().charAt(0).toUpperCase();

  // Personalización de la franja de stats: qué tarjeta secundaria destacar
  // además del objetivo, según el tipo de objetivo — determinista, sin IA
  // (ver STATS_FOCUS_BY_GOAL en lib/engine/recommendation-engine.ts y
  // docs/SIMPLIFIED_VISION.md).
  const focusDomain = goalType ? STATS_FOCUS_BY_GOAL[goalType] : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          <View>
            <Text style={{ color: colors.text2, fontSize: 13 }}>{greeting()},</Text>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }}>
              {name || 'there'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{initial}</Text>
          </Pressable>
        </View>

        {/* STATS — objetivo siempre visible; la tarjeta secundaria y el
            tracking se personalizan según el tipo de objetivo (ver
            STATS_FOCUS_BY_GOAL). La conversación podrá afinar esto más
            adelante, cuando exista el chat (ver docs/SIMPLIFIED_VISION.md). */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
          <GoalSummaryCard />

          {plan && focusDomain === 'nutrition' && (
            <Card>
              <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                TODAY'S TARGET
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {plan.nutrition.kcal} kcal · {plan.nutrition.protein_g}g protein
              </Text>
              <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{plan.nutrition.mealsPerDay} meals/day</Text>
            </Card>
          )}

          {plan && focusDomain === 'training' && (
            <Card>
              <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                TRAINING PLAN
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{plan.training.daysPerWeek}x/week</Text>
              <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                {plan.training.phase ?? plan.training.level}
              </Text>
            </Card>
          )}

          <TrackingCard />
        </View>

        {/* CHAT — v1: responde y ya registra peso/comida (ver lib/data/chat.ts) */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, paddingHorizontal: spacing.lg, marginTop: spacing.md }}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
              <Feather name="message-circle" size={28} color={colors.text2} />
              <Text style={{ color: colors.text2, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                Pregúntame sobre tu objetivo o tu plan de hoy — o cuéntame qué pesaste o qué comiste.
              </Text>
            </View>
          ) : (
            messages.map((m) => (
              <View
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: m.role === 'user' ? colors.accent : colors.surface2,
                  borderRadius: 16,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 10,
                  marginBottom: spacing.sm,
                  maxWidth: '85%',
                }}
              >
                <Text style={{ color: m.role === 'user' ? '#fff' : colors.text, fontSize: 14, lineHeight: 19 }}>{m.text}</Text>
              </View>
            ))
          )}
          {sending && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe aquí…"
            placeholderTextColor={colors.text2}
            onSubmitEditing={handleSend}
            editable={!sending}
            style={{
              flex: 1,
              backgroundColor: colors.surface2,
              borderRadius: 20,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              color: colors.text,
              fontSize: 14,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() ? colors.accent : colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="arrow-up" size={18} color={draft.trim() ? '#fff' : colors.text2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
