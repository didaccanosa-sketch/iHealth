import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useGoalEvaluation } from '../../components/goal/useGoalEvaluation';
import { getStrategyRecommendationWithAdjustment } from '../../lib/data/recommendation';
import { StrategyPlan, STATS_FOCUS_BY_GOAL } from '../../lib/engine/recommendation-engine';
import { sendChatMessage, finalizeWorkoutProposal, WorkoutProposal, confirmDietProposal, DietProposal } from '../../lib/data/chat';
import { CLOSED_CHAT_FIELDS, isClosedChatField, FOCUS_MUSCLE_OPTIONS } from '../../lib/data/chat-options';
import { setPendingWorkoutDraft } from '../../lib/data/pending-workout-draft';
import { fetchMesocycles, fetchMesocycleDetail } from '../../lib/data/workout';
import { getSessionDef } from '../../lib/engine/workout-engine';

type NextSession = { dayLabel: string; week: number; isDeload: boolean } | null;

// Pantalla única (ver docs/SIMPLIFIED_VISION.md): cabecera + stats + chat.
// El chat (v1) responde preguntas y ya registra peso/comida con una
// interpretación básica — ver lib/data/chat.ts y
// supabase/functions/chat-assistant. Entreno todavía no se puede registrar
// desde aquí (se avisa en el propio chat).

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  proposal?: WorkoutProposal | null;
  proposalResolved?: boolean; // true tras confirmar/cancelar — deja de mostrar los botones
  dietProposal?: DietProposal | null;
  dietProposalResolved?: boolean;
  // Campo cerrado que el chat está preguntando ahora mismo (ver
  // lib/data/chat-options.ts) — se muestra como botones, nunca junto a otra
  // pregunta. Null/undefined si no hay pregunta pendiente en este mensaje.
  askField?: string | null;
  askFieldResolved?: boolean;
};

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
  const [nextSession, setNextSession] = useState<NextSession>(null);
  const [hasActiveMeso, setHasActiveMeso] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Mensaje de identidad faltante — no pasa por la IA, solo una vez por
  // sesión (ver docs/SIMPLIFIED_VISION.md).
  const identityPromptShownRef = useRef(false);
  const redirectedToOnboardingRef = useRef(false);
  // El chat no se guarda — solo lo que registra (peso, comidas, objetivo...).
  // Cada día empieza en blanco; esto es lo que detecta el cambio de día.
  const chatDayRef = useRef(new Date().toISOString().slice(0, 10));

  const { goalType, hasGoal, loading: goalLoading, reload: reloadGoal } = useGoalEvaluation(userId);

  const load = useCallback(async () => {
    const profile = await fetchProfile(userId).catch(() => null);
    setName(profile?.name || null);
    const result = await getStrategyRecommendationWithAdjustment(userId).catch(() => null);
    setPlan(result?.plan ?? null);
    setLoaded(true);

    // Enlace a "seguir tu plan" — se perdió al quitar las pestañas, se
    // repone aquí (ver tarea "Enlace a seguir tu plan").
    const mesos = await fetchMesocycles(userId).catch(() => []);
    const active = mesos.find((m) => m.started && !m.finished);
    if (active) {
      setHasActiveMeso(true);
      const detail = await fetchMesocycleDetail(active.id).catch(() => null);
      if (detail) {
        const def = getSessionDef(detail, detail.current_index);
        setNextSession({ dayLabel: def.dayLabel, week: def.week, isDeload: def.isDeload });
      }
    } else {
      setHasActiveMeso(false);
      setNextSession(null);
    }
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

  const handleSend = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || sending) return;
      setDraft('');
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
      setSending(true);
      try {
        const result = await sendChatMessage(
          userId,
          text,
          messages.map((m) => ({ role: m.role, text: m.text }))
        );
        setMessages((prev) => {
          // Una propuesta nueva sustituye a la anterior sin pedir cancelarla a
          // mano — así "cambia esto" funciona hablando, sin fricción (ver
          // conversación sobre editar la rutina/el menú antes de crearlos).
          let next = prev;
          if (result.proposal) next = next.map((m) => (m.proposal && !m.proposalResolved ? { ...m, proposalResolved: true } : m));
          if (result.dietProposal) next = next.map((m) => (m.dietProposal && !m.dietProposalResolved ? { ...m, dietProposalResolved: true } : m));
          return [
            ...next,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: result.reply,
              proposal: result.proposal ?? null,
              dietProposal: result.dietProposal ?? null,
              askField: result.askField ?? null,
            },
          ];
        });
        // Un registro (peso/comida/objetivo/identidad) puede haber cambiado el
        // plan — reload() vuelve a leer de Supabase (no reusa el modelo en
        // memoria, que puede estar desactualizado si el chat acaba de escribir
        // el objetivo/identidad por un camino distinto al de este hook).
        load();
        reloadGoal();
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: 'No he podido responder — inténtalo de nuevo en un momento.' },
        ]);
      } finally {
        setSending(false);
      }
    },
    [draft, sending, userId, load, reloadGoal, messages]
  );

  // Botón de una pregunta de opciones cerradas (ver lib/data/chat-options.ts)
  // — envía la opción elegida como si el usuario la hubiera escrito, sin
  // dejarle teclear. Nunca hay dos preguntas de este tipo abiertas a la vez.
  const handleSelectChatOption = useCallback(
    (messageId: string, label: string) => {
      if (sending) return;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, askFieldResolved: true } : m)));
      handleSend(label);
    },
    [sending, handleSend]
  );

  // Botón de la última pregunta antes de generar una rutina (qué grupo
  // priorizar) — a diferencia de las demás, esta no vuelve a pasar por la
  // IA: en este punto ya está todo lo demás confirmado, así que se genera
  // la propuesta directa (ver finalizeWorkoutProposal en lib/data/chat.ts).
  const handleSelectFocus = useCallback(
    async (messageId: string, label: string, groups: string[]) => {
      if (sending) return;
      setMessages((prev) => [
        ...prev.map((m) => (m.id === messageId ? { ...m, askFieldResolved: true } : m)),
        { id: `u-${Date.now()}`, role: 'user', text: label },
      ]);
      setSending(true);
      try {
        const result = await finalizeWorkoutProposal(userId, groups);
        setMessages((prev) => {
          const next = prev.map((m) => (m.proposal && !m.proposalResolved ? { ...m, proposalResolved: true } : m));
          return [...next, { id: `a-${Date.now()}`, role: 'assistant', text: result.reply, proposal: result.proposal ?? null }];
        });
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: 'No he podido preparar una propuesta ahora mismo — inténtalo de nuevo en un momento.' },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending, userId]
  );

  const resolveProposal = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, proposalResolved: true } : m)));
  }, []);

  // La rutina nunca se crea directa desde el chat — se manda al wizard de
  // Training (mismo sitio donde se editan las rutinas manuales) para que el
  // usuario pueda añadir/quitar ejercicios y cambiar series/reps antes de
  // confirmarla de verdad (ver lib/data/pending-workout-draft.ts).
  const handleReviewProposal = useCallback(
    (messageId: string, proposal: WorkoutProposal) => {
      resolveProposal(messageId);
      setPendingWorkoutDraft(proposal.input);
      router.push('/training?open=wizard');
    },
    [resolveProposal, router]
  );

  const handleCancelProposal = useCallback(
    (messageId: string) => {
      resolveProposal(messageId);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: 'Vale, no la creo.' }]);
    },
    [resolveProposal]
  );

  const resolveDietProposal = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, dietProposalResolved: true } : m)));
  }, []);

  const handleConfirmDietProposal = useCallback(
    async (messageId: string, dietProposal: DietProposal) => {
      resolveDietProposal(messageId);
      setSending(true);
      try {
        const name = `Chat - ${new Date().toLocaleDateString()}`;
        await confirmDietProposal(userId, dietProposal.plan, name);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Guardado como plantilla "${name}" — aplícala desde Nutrition cuando quieras (comida a comida o de golpe).`,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: 'No he podido guardar el menú — inténtalo de nuevo en un momento.' },
        ]);
      } finally {
        setSending(false);
      }
    },
    [userId, resolveDietProposal]
  );

  const handleCancelDietProposal = useCallback(
    (messageId: string) => {
      resolveDietProposal(messageId);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: 'Vale, no lo guardo.' }]);
    },
    [resolveDietProposal]
  );

  useFocusEffect(
    useCallback(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (chatDayRef.current !== today) {
        chatDayRef.current = today;
        setMessages([]);
        identityPromptShownRef.current = false;
      }
      load();
    }, [load])
  );

  // Auto-scroll: cualquier mensaje nuevo (tuyo, del asistente, o uno que
  // aparece solo como el aviso de ajuste de calorías) baja el chat del todo
  // — nunca hace falta hacerlo a mano.
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  // Onboarding real: la primera vez (sin objetivo confirmado) se manda a
  // /onboarding en vez de mostrar esta pantalla vacía — ver
  // docs/SIMPLIFIED_VISION.md. Ya no se puede saltar (el onboarding exige
  // perfil completo antes de dejar continuar), así que basta con mirar si
  // hay objetivo. Si ya hay objetivo pero falta identidad básica (caso raro
  // hoy, pero posible en cuentas de antes de este cambio), se pregunta
  // desde esta pantalla más abajo.
  useEffect(() => {
    if (goalLoading || redirectedToOnboardingRef.current) return;
    if (!hasGoal) {
      redirectedToOnboardingRef.current = true;
      router.replace('/onboarding');
    }
  }, [goalLoading, hasGoal, router]);

  useEffect(() => {
    if (!loaded || !plan || identityPromptShownRef.current) return;
    const missingIdentity = plan.explanations.nutrition.some((s) => s.startsWith('Todavía no tenemos tu edad'));
    if (missingIdentity) {
      identityPromptShownRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `identity-${Date.now()}`,
          role: 'assistant',
          text: 'Para calcular esto a tu medida me faltan un par de datos de tu perfil — ¿cuántos años tienes, tu sexo, tu altura y tu peso actual?',
        },
      ]);
    }
  }, [loaded, plan]);

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
            <Pressable onPress={() => router.push('/nutrition')}>
              <Card>
                <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                  TODAY'S TARGET
                </Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                  {plan.nutrition.kcal} kcal · {plan.nutrition.protein_g}g protein
                </Text>
                <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{plan.nutrition.mealsPerDay} meals/day · Tap for details</Text>
              </Card>
            </Pressable>
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

          {hasActiveMeso && nextSession ? (
            <Pressable onPress={() => router.push('/training?open=active')}>
              <Card>
                <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                  YOUR PLAN
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Feather name="activity" size={18} color={colors.accent} />
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                      {nextSession.dayLabel}
                    </Text>
                    <Text style={{ color: colors.text2, fontSize: 11, marginTop: 1 }}>
                      Week {nextSession.week}
                      {nextSession.isDeload ? ' · Deload' : ''} · Tap to continue
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/training')}>
              <Card style={{ borderStyle: 'dashed' }}>
                <Text style={{ color: colors.text2, fontSize: 12, textAlign: 'center' }}>
                  No active training plan — tap to start one.
                </Text>
              </Card>
            </Pressable>
          )}
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

                {isClosedChatField(m.askField) && !m.askFieldResolved && (
                  <View style={{ marginTop: spacing.sm, gap: 6 }}>
                    {CLOSED_CHAT_FIELDS[m.askField].map((opt) => (
                      <Pressable
                        key={String(opt.value)}
                        onPress={() => handleSelectChatOption(m.id, opt.label)}
                        disabled={sending}
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {m.askField === 'focusMuscleGroups' && !m.askFieldResolved && (
                  <View style={{ marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {FOCUS_MUSCLE_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.label}
                        onPress={() => handleSelectFocus(m.id, opt.label, opt.value)}
                        disabled={sending}
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {m.proposal && !m.proposalResolved && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={{ color: colors.text2, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm }}>
                      {m.proposal.summary}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        onPress={() => handleReviewProposal(m.id, m.proposal as WorkoutProposal)}
                        style={{ backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Revisar y editar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleCancelProposal(m.id)}
                        style={{ backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
                      >
                        <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 12 }}>Cancelar</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {m.dietProposal && !m.dietProposalResolved && (
                  <View style={{ marginTop: spacing.sm }}>
                    {m.dietProposal.plan.meals.map((meal) => (
                      <Text key={meal.slot} style={{ color: colors.text2, fontSize: 12, lineHeight: 17, marginBottom: 4 }}>
                        Comida {meal.slot}: {meal.description} — {meal.kcal} kcal / {meal.protein_g}g proteína
                      </Text>
                    ))}
                    <Text style={{ color: colors.text2, fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: spacing.sm, fontStyle: 'italic' }}>
                      {m.dietProposal.summary}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        onPress={() => handleConfirmDietProposal(m.id, m.dietProposal as DietProposal)}
                        style={{ backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Guardar menú</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleCancelDietProposal(m.id)}
                        style={{ backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
                      >
                        <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 12 }}>Cancelar</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
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
            onSubmitEditing={() => handleSend()}
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
            onPress={() => handleSend()}
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
