import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../lib/theme-context';
import { useAuth } from '../lib/auth-context';
import { spacing, radius } from '../constants/theme';
import { sendChatMessage, saveIdentity, saveHelpAreas } from '../lib/data/chat';
import { useGoalEvaluation } from '../components/goal/useGoalEvaluation';
import { Sex, HelpArea } from '../features/profile/engine/types';

// Pantalla de onboarding — solo la primera vez, antes de entrar a la
// pantalla única (ver docs/SIMPLIFIED_VISION.md). Dos pasos:
// 1) Un formulario nativo (nombre, edad, sexo, altura, peso) — datos fijos
//    y estructurados, se piden con campos normales en vez de conversación,
//    resulta más natural que preguntarlo uno a uno por chat (ver
//    conversación de diseño).
// 2) El chat, que ya solo se encarga del objetivo — ahí sí tiene sentido
//    la conversación libre, porque no hay una respuesta con formato fijo.
// No se puede pasar a la pantalla única hasta tener el perfil completo —
// sin eso el resto de la app trabaja con genéricos poco útiles.

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  helpAreaOptions?: boolean;
  helpAreaResolved?: boolean;
};

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: 'other', label: 'Otro' },
];

const HELP_AREA_OPTIONS: { value: HelpArea; label: string }[] = [
  { value: 'training', label: 'Rutinas de entreno' },
  { value: 'nutrition', label: 'Comidas y nutrición' },
  { value: 'weight_tracking', label: 'Seguimiento de peso' },
  { value: 'all', label: 'Un poco de todo' },
];

export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id as string;

  const { model, hasGoal, reload: reloadGoal } = useGoalEvaluation(userId);

  const nameComplete = !!model && model.identity.firstName.status === 'confirmed';
  const ageSexComplete = !!model && model.identity.age.status === 'confirmed' && model.identity.sex.status === 'confirmed';
  const heightWeightComplete =
    !!model && model.identity.heightCm.status === 'confirmed' && model.identity.startingWeightKg.status === 'confirmed';
  const identityComplete = nameComplete && ageSexComplete && heightWeightComplete;
  const helpAreasComplete = !!model && model.preferences.helpAreas.status === 'confirmed';
  const profileComplete = hasGoal && identityComplete && helpAreasComplete;

  // ─── Paso 1: formulario ───────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);

  const formValid = useMemo(() => {
    const age = Number(ageYears);
    const height = Number(heightCm);
    const weight = Number(weightKg);
    return firstName.trim().length > 0 && !!sex && age > 0 && height > 0 && weight > 0;
  }, [firstName, ageYears, sex, heightCm, weightKg]);

  const handleSubmitIdentity = useCallback(async () => {
    if (!formValid || savingIdentity) return;
    setSavingIdentity(true);
    try {
      await saveIdentity(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        ageYears: Number(ageYears),
        sex,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
      });
      reloadGoal();
    } finally {
      setSavingIdentity(false);
    }
  }, [formValid, savingIdentity, userId, firstName, lastName, ageYears, sex, heightCm, weightKg, reloadGoal]);

  // ─── Paso 2: chat (solo objetivo) ──────────────────────────────────────
  const welcome = useMemo<ChatMessage>(
    () => ({
      id: 'welcome',
      role: 'assistant',
      text: `¡Hola${firstName ? ' ' + firstName.trim() : ''}! Para terminar, cuéntame cuál es tu objetivo — perder peso, ganar músculo, mejorar tu resistencia, lo que sea.`,
    }),
    [firstName]
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [savingHelpAreas, setSavingHelpAreas] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const chatStartedRef = useRef(false);
  const helpAreaPromptShownRef = useRef(false);

  useEffect(() => {
    if (identityComplete && !chatStartedRef.current) {
      chatStartedRef.current = true;
      setMessages([welcome]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityComplete]);

  // Última pregunta del perfil, con opciones en vez de texto libre — encaja
  // mejor que escribirlo (ver conversación de diseño).
  useEffect(() => {
    if (!hasGoal || helpAreasComplete || helpAreaPromptShownRef.current) return;
    helpAreaPromptShownRef.current = true;
    setMessages((prev) => [
      ...prev,
      {
        id: `help-${Date.now()}`,
        role: 'assistant',
        text: '¿En qué quieres que te ayude sobre todo?',
        helpAreaOptions: true,
      },
    ]);
  }, [hasGoal, helpAreasComplete]);

  const handleSelectHelpArea = useCallback(
    async (messageId: string, value: HelpArea, label: string) => {
      if (savingHelpAreas) return;
      setSavingHelpAreas(true);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, helpAreaResolved: true } : m)));
      try {
        await saveHelpAreas(userId, [value]);
        setMessages((prev) => [...prev, { id: `u-help-${Date.now()}`, role: 'user', text: label }]);
        reloadGoal();
      } finally {
        setSavingHelpAreas(false);
      }
    },
    [savingHelpAreas, userId, reloadGoal]
  );

  const goToApp = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
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
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: result.reply }]);
      reloadGoal();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: 'No he podido responder — inténtalo de nuevo en un momento.' },
      ]);
    } finally {
      setSending(false);
    }
  }, [draft, sending, userId, reloadGoal, messages]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  if (!identityComplete) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Empecemos</Text>
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2, marginBottom: spacing.lg }}>
              Cuéntanos un poco de ti para calcular todo a tu medida.
            </Text>

            <FormField label="Nombre">
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Tu nombre"
                placeholderTextColor={colors.text2}
                style={inputStyle(colors)}
              />
            </FormField>

            <FormField label="Apellidos (opcional)">
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Tus apellidos"
                placeholderTextColor={colors.text2}
                style={inputStyle(colors)}
              />
            </FormField>

            <FormField label="Edad">
              <TextInput
                value={ageYears}
                onChangeText={setAgeYears}
                placeholder="Años"
                placeholderTextColor={colors.text2}
                keyboardType="number-pad"
                style={inputStyle(colors)}
              />
            </FormField>

            <FormField label="Sexo">
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {SEX_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSex(opt.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      backgroundColor: sex === opt.value ? colors.accent : colors.surface2,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: sex === opt.value ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            <FormField label="Altura (cm)">
              <TextInput
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="Ej. 175"
                placeholderTextColor={colors.text2}
                keyboardType="number-pad"
                style={inputStyle(colors)}
              />
            </FormField>

            <FormField label="Peso actual (kg)">
              <TextInput
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="Ej. 78"
                placeholderTextColor={colors.text2}
                keyboardType="decimal-pad"
                style={inputStyle(colors)}
              />
            </FormField>

            <Pressable
              onPress={handleSubmitIdentity}
              disabled={!formValid || savingIdentity}
              style={{
                backgroundColor: formValid ? colors.accent : colors.surface2,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
                marginTop: spacing.md,
              }}
            >
              {savingIdentity ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: formValid ? '#fff' : colors.text2, fontWeight: '700', fontSize: 14 }}>Continuar</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Ya casi</Text>
          <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
            {profileComplete ? 'Todo listo.' : 'Solo falta terminar tu perfil.'}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, paddingHorizontal: spacing.lg, marginTop: spacing.md }}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
        >
          {messages.map((m) => (
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

              {m.helpAreaOptions && !m.helpAreaResolved && (
                <View style={{ marginTop: spacing.sm, gap: 6 }}>
                  {HELP_AREA_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleSelectHelpArea(m.id, opt.value, opt.label)}
                      disabled={savingHelpAreas}
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
            </View>
          ))}
          {sending && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />}
        </ScrollView>

        {profileComplete && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Pressable
              onPress={goToApp}
              style={{ backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Continuar a tu plan</Text>
            </Pressable>
          </View>
        )}

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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useAppTheme>['colors']) {
  return {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;
}
