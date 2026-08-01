// Tira discreta de progressive profiling — no es una pantalla propia, vive
// incrustada al final de Today (ver TODO.md / docs/USER_MODEL.md). Muestra
// como mucho una pregunta a la vez, con flecha atrás (deshacer la última
// respuesta) y flecha adelante (saltar la actual sin contestarla). Todo el
// historial de esta sesión vive solo en memoria — se resetea al reabrir la
// app, no se persiste en ningún sitio.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';
import { spacing } from '../../constants/theme';
import { loadUserModel, saveUserModel } from './data/user-model-data';
import { analyzeFreeTextAnswer } from './data/analyze-answer';
import { revertField } from './engine/user-model';
import { applyAnswer, getNextQuestions } from './engine/questions';
import type { Question } from './engine/questions';
import type { Field, UserModelData } from './engine/types';

type HistoryEntry =
  | { type: 'answered'; question: Question; previousField: Field<unknown> }
  | { type: 'skipped'; question: Question };

function pickNext(model: UserModelData, skipped: Set<string>): Question | null {
  const candidates = getNextQuestions(model, 50);
  return candidates.find((q) => !skipped.has(q.id)) ?? null;
}

export function QuestionCard({ userId }: { userId: string }) {
  const { colors } = useAppTheme();
  const [model, setModel] = useState<UserModelData | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [textValue, setTextValue] = useState('');

  // El modelo puede haber cambiado fuera de esta tarjeta (ej. objetivo
  // fijado desde Progress) mientras Today se queda montado en segundo plano
  // al cambiar de pestaña — sin esto, la tarjeta seguía preguntando algo que
  // ya se había respondido en otro sitio porque nunca recargaba el modelo.
  const skippedRef = useRef(skipped);
  useEffect(() => {
    skippedRef.current = skipped;
  }, [skipped]);

  useEffect(() => {
    setTextValue('');
  }, [question?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadUserModel(userId)
        .then((m) => {
          if (cancelled) return;
          setModel(m);
          setQuestion(pickNext(m, skippedRef.current));
        })
        .catch(() => {
          // si falla la carga, simplemente no se muestra la tira
        });
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  const answer = useCallback(
    async (value: unknown) => {
      if (!model || !question || saving) return;
      setSaving(true);
      const previousField = model[question.category][question.field as keyof (typeof model)[typeof question.category]] as unknown as Field<unknown>;
      const next = applyAnswer(model, question.id, value);
      setHistory((h) => [...h, { type: 'answered', question, previousField }]);
      setModel(next);
      setQuestion(pickNext(next, skipped));
      try {
        await saveUserModel(userId, next);
      } catch {
        // el modelo en memoria ya avanzó; se reintenta guardar en la
        // próxima respuesta o carga, no bloqueamos la UI por esto
      }
      setSaving(false);
    },
    [model, question, saving, skipped, userId]
  );

  // Respuesta local sin IA (separar por comas) — solo como respaldo si la
  // función de IA falla o no está desplegada todavía.
  const splitLocally = (raw: string): string[] =>
    raw
      .split(/[,;\n]| y /i)
      .map((s) => s.trim())
      .filter(Boolean);

  const submitText = useCallback(async () => {
    if (!question || saving) return;
    const raw = textValue.trim();
    if (!raw) return;

    if (question.answerType === 'number') {
      const n = Number(raw.replace(',', '.'));
      if (Number.isNaN(n)) return;
      answer(n);
      return;
    }

    if (question.isList) {
      setSaving(true);
      try {
        const items = await analyzeFreeTextAnswer(raw, question.text);
        answer(items);
      } catch {
        // la IA no ha podido normalizarlo (o la función no está desplegada
        // todavía) — se guarda tal cual, separado por comas, como respaldo
        answer(splitLocally(raw));
      }
      setSaving(false);
      return;
    }

    answer(raw);
  }, [question, saving, textValue, answer]);

  const skip = useCallback(() => {
    if (!question) return;
    const nextSkipped = new Set(skipped).add(question.id);
    setHistory((h) => [...h, { type: 'skipped', question }]);
    setSkipped(nextSkipped);
    setQuestion(model ? pickNext(model, nextSkipped) : null);
  }, [question, skipped, model]);

  const goBack = useCallback(() => {
    if (history.length === 0 || !model) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (last.type === 'skipped') {
      const nextSkipped = new Set(skipped);
      nextSkipped.delete(last.question.id);
      setSkipped(nextSkipped);
      setQuestion(last.question);
      return;
    }
    const reverted = revertField(model, last.question.category, last.question.field as never, last.previousField as never);
    setModel(reverted);
    setQuestion(last.question);
    saveUserModel(userId, reverted).catch(() => {
      // igual que arriba, no bloqueamos la UI si falla el guardado
    });
  }, [history, model, skipped, userId]);

  if (!question && history.length === 0) return null;

  const canGoBack = history.length > 0;

  return (
    <Card variant="glass" style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable onPress={goBack} disabled={!canGoBack} hitSlop={8}>
          <Feather name="chevron-left" size={16} color={canGoBack ? colors.text2 : colors.border} />
        </Pressable>

        <View style={{ flex: 1 }}>
          {question ? (
            <>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', marginBottom: 6 }} numberOfLines={1}>
                {question.text}
              </Text>

              {question.answerType === 'single_choice' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {question.options?.map((opt, i) => (
                    <Pressable
                      key={i}
                      disabled={saving}
                      onPress={() => answer(opt.value)}
                      style={{
                        backgroundColor: colors.surface2,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        opacity: saving ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View>
                  {question.options && question.options.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {question.options.map((opt, i) => (
                        <Pressable
                          key={i}
                          disabled={saving}
                          onPress={() => answer(opt.value)}
                          style={{
                            backgroundColor: colors.surface2,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            opacity: saving ? 0.5 : 1,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={textValue}
                      onChangeText={setTextValue}
                      onSubmitEditing={submitText}
                      placeholder={question.answerType === 'number' ? 'Escribe un número...' : 'Escribe aquí...'}
                      placeholderTextColor={colors.text2}
                      keyboardType={question.answerType === 'number' ? 'decimal-pad' : 'default'}
                      returnKeyType="done"
                      editable={!saving}
                      style={{
                        flex: 1,
                        backgroundColor: colors.surface2,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        color: colors.text,
                        fontSize: 12,
                      }}
                    />
                    <Pressable onPress={submitText} disabled={saving || !textValue.trim()} hitSlop={8}>
                      <Feather
                        name="check-circle"
                        size={20}
                        color={textValue.trim() ? colors.accent : colors.border}
                      />
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text style={{ color: colors.text2, fontSize: 12 }}>No hay más preguntas por ahora</Text>
          )}
        </View>

        <Pressable onPress={skip} disabled={!question} hitSlop={8}>
          <Feather name="chevron-right" size={16} color={question ? colors.text2 : colors.border} />
        </Pressable>
      </View>
    </Card>
  );
}
