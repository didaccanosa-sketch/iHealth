import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../Card';
import { FadeIn } from '../FadeIn';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';
import { MuscleGroup, Level, Phase } from '../../lib/engine/types';
import { MUSCLE_GROUPS, analyzeSplit, explainFocusChoices } from '../../lib/engine/workout-engine';
import { EXERCISE_DB } from '../../lib/engine/exercise-db';
import { NewMesoInput } from '../../lib/data/workout';

type WizardDay = { label: string; exercises: { name: string; muscle_group: MuscleGroup; sets: number; reps: string }[] };
type WizardForm = {
  level: Level;
  phase: Phase;
  duration_weeks: number;
  days_per_week: number;
  days: WizardDay[];
};

const PHASES: { id: Phase; label: string }[] = [
  { id: 'volumen', label: 'Volume' },
  { id: 'mantenimiento', label: 'Maintenance' },
  { id: 'definicion', label: 'Cut' },
];
const LEVELS: { id: Level; label: string }[] = [
  { id: 'principiante', label: 'Beginner' },
  { id: 'avanzado', label: 'Advanced' },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: on ? colors.accent : colors.surface2,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: on ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function MesoWizard({
  initial,
  onCancel,
  onCreate,
}: {
  initial?: NewMesoInput | null;
  onCancel: () => void;
  onCreate: (input: NewMesoInput) => void;
}) {
  const { colors } = useAppTheme();
  const [step, setStep] = useState<1 | 2 | 3>(initial ? 3 : 1);
  const [form, setForm] = useState<WizardForm>(() =>
    initial
      ? {
          level: initial.level,
          phase: initial.phase,
          duration_weeks: initial.duration_weeks,
          days_per_week: initial.days_per_week,
          days: initial.days,
        }
      : { level: 'principiante', phase: 'volumen', duration_weeks: 6, days_per_week: 4, days: [] }
  );
  const [dayIdx, setDayIdx] = useState(0);
  const [exGroup, setExGroup] = useState<MuscleGroup | null>(null);
  const [query, setQuery] = useState('');
  const [showRecommendInfo, setShowRecommendInfo] = useState(false);

  function goToDays() {
    if (form.days.length !== form.days_per_week) {
      const days: WizardDay[] = Array.from({ length: form.days_per_week }, (_, i) => ({ label: `Day ${i + 1}`, exercises: [] }));
      setForm((f) => ({ ...f, days }));
    }
    setDayIdx(0);
    setExGroup(null);
    setStep(2);
  }

  function updateDayLabel(label: string) {
    setForm((f) => {
      const days = [...f.days];
      days[dayIdx] = { ...days[dayIdx], label };
      return { ...f, days };
    });
  }

  function addExercise(name: string) {
    if (!name.trim() || !exGroup) return;
    setForm((f) => {
      const days = [...f.days];
      days[dayIdx] = {
        ...days[dayIdx],
        exercises: [...days[dayIdx].exercises, { name: name.trim(), muscle_group: exGroup, sets: 3, reps: '8-12' }],
      };
      return { ...f, days };
    });
    setQuery('');
  }

  function removeExercise(i: number) {
    setForm((f) => {
      const days = [...f.days];
      days[dayIdx] = { ...days[dayIdx], exercises: days[dayIdx].exercises.filter((_, idx) => idx !== i) };
      return { ...f, days };
    });
  }

  function updateExercise(i: number, patch: Partial<{ sets: number; reps: string }>) {
    setForm((f) => {
      const days = [...f.days];
      const exercises = [...days[dayIdx].exercises];
      exercises[i] = { ...exercises[i], ...patch };
      days[dayIdx] = { ...days[dayIdx], exercises };
      return { ...f, days };
    });
  }

  function moveExerciseInDay(targetDayIdx: number, exIdx: number, direction: -1 | 1) {
    setForm((f) => {
      const days = [...f.days];
      const exercises = [...days[targetDayIdx].exercises];
      const newIdx = exIdx + direction;
      if (newIdx < 0 || newIdx >= exercises.length) return f;
      [exercises[exIdx], exercises[newIdx]] = [exercises[newIdx], exercises[exIdx]];
      days[targetDayIdx] = { ...days[targetDayIdx], exercises };
      return { ...f, days };
    });
  }

  const suggestions = useMemo(() => {
    if (!exGroup) return [];
    const list = EXERCISE_DB[exGroup] || [];
    const q = query.trim().toLowerCase();
    return (q ? list.filter((n) => n.toLowerCase().includes(q)) : list).slice(0, 8);
  }, [exGroup, query]);

  const warnings = useMemo(() => {
    if (step !== 3) return '';
    const general = analyzeSplit(form.days as any, form.phase, form.level);
    if (initial?.generatedFrom === 'focus') {
      const explanation = explainFocusChoices(form.days as any, initial.focusPriority || []);
      return [explanation, general].filter(Boolean).join(' ');
    }
    return general;
  }, [step, form, initial]);

  const day = form.days[dayIdx];

  return (
    <View>
      <Pressable onPress={onCancel} style={{ marginBottom: 10 }}>
        <Text style={{ color: colors.text2 }}>✕ Cancel</Text>
      </Pressable>

      {step === 1 && (
        <FadeIn trigger={step}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>New mesocycle — basic info</Text>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Level</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {LEVELS.map((l) => (
              <Chip key={l.id} label={l.label} on={form.level === l.id} onPress={() => setForm((f) => ({ ...f, level: l.id }))} />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Phase</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {PHASES.map((p) => (
              <Chip key={p.id} label={p.label} on={form.phase === p.id} onPress={() => setForm((f) => ({ ...f, phase: p.id }))} />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Duration (weeks, deload not included)</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {[4, 5, 6, 7, 8].map((n) => (
              <Chip key={n} label={String(n)} on={form.duration_weeks === n} onPress={() => setForm((f) => ({ ...f, duration_weeks: n }))} />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Training days per week</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip key={n} label={String(n)} on={form.days_per_week === n} onPress={() => setForm((f) => ({ ...f, days_per_week: n }))} />
            ))}
          </View>
          <Text style={{ color: colors.text2, fontSize: 11, marginBottom: 14 }}>
            A deload week (fewer sets, high RIR) is added automatically at the end.
          </Text>

          <Pressable onPress={goToDays} style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Continue → choose exercises</Text>
          </Pressable>
        </Card>
        </FadeIn>
      )}

      {step === 2 && day && (
        <FadeIn trigger={step}>
        <Card>
          <Text style={{ color: colors.text2, fontSize: 12 }}>
            Day {dayIdx + 1} of {form.days_per_week}
          </Text>
          <TextInput
            value={day.label}
            onChangeText={updateDayLabel}
            style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 4, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 }}
          />

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Muscle group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {MUSCLE_GROUPS.map((g) => (
              <Chip key={g.id} label={g.label} on={exGroup === g.id} onPress={() => { setExGroup(g.id); setQuery(''); }} />
            ))}
          </ScrollView>

          {exGroup ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search or type an exercise..."
                placeholderTextColor={colors.text2}
                style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}
              />
              {suggestions.length > 0 && (
                <Text style={{ color: colors.text2, fontSize: 11, marginBottom: 6 }}>Tap an exercise to add it</Text>
              )}
              <View style={{ marginBottom: 12 }}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => addExercise(s)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: pressed ? colors.accent : colors.surface2,
                      borderRadius: 12,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    {({ pressed }) => (
                      <>
                        <Text style={{ color: pressed ? colors.accentText : colors.text, fontSize: 13 }}>{s}</Text>
                        <Feather name="plus-circle" size={18} color={pressed ? colors.accentText : colors.accent} />
                      </>
                    )}
                  </Pressable>
                ))}
                {!!query.trim() && !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
                  <Pressable
                    onPress={() => addExercise(query)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: pressed ? colors.accent : colors.surface2,
                      borderRadius: 12,
                      borderStyle: 'dashed',
                      borderWidth: 1,
                      borderColor: colors.accent,
                    })}
                  >
                    {({ pressed }) => (
                      <>
                        <Text style={{ color: pressed ? colors.accentText : colors.accent, fontSize: 13 }}>Add "{query}" as is</Text>
                        <Feather name="plus-circle" size={18} color={pressed ? colors.accentText : colors.accent} />
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 12 }}>Pick a muscle group to search exercises</Text>
          )}

          {day.exercises.map((ex, i) => (
            <View key={i} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{ex.name}</Text>
                  <Text style={{ color: colors.text2, fontSize: 11 }}>{MUSCLE_GROUPS.find((g) => g.id === ex.muscle_group)?.label}</Text>
                </View>
                <Pressable onPress={() => removeExercise(i)}>
                  <Text style={{ color: colors.text2, fontSize: 16 }}>×</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExercise(i, { sets: parseInt(v) || 1 })}
                  keyboardType="numeric"
                  placeholder="sets"
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8, color: colors.text, textAlign: 'center' }}
                />
                <TextInput
                  value={ex.reps}
                  onChangeText={(v) => updateExercise(i, { reps: v })}
                  placeholder="8-12"
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8, color: colors.text, textAlign: 'center' }}
                />
              </View>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {dayIdx > 0 ? (
              <Pressable onPress={() => { setDayIdx(dayIdx - 1); setExGroup(null); }} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.text2 }}>← Previous day</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setStep(1)} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.text2 }}>← Basic info</Text>
              </Pressable>
            )}
            {dayIdx < form.days_per_week - 1 ? (
              <Pressable
                onPress={() => { if (day.exercises.length) { setDayIdx(dayIdx + 1); setExGroup(null); } }}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>Next day →</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => { if (day.exercises.length) setStep(3); }}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>Analyze routine</Text>
              </Pressable>
            )}
          </View>
        </Card>
        </FadeIn>
      )}

      {step === 3 && (
        <FadeIn trigger={step}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>What I think of this routine</Text>
              {initial?.generatedFrom === 'recommendation' && (
                <Pressable onPress={() => setShowRecommendInfo((v) => !v)} hitSlop={8}>
                  <Feather name="info" size={15} color={colors.text2} />
                </Pressable>
              )}
            </View>
            <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{warnings}</Text>
            {showRecommendInfo && initial?.generatedFrom === 'recommendation' && (
              <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, marginTop: 10 }}>
                {(initial.recommendationExplanations || []).map((line, i) => (
                  <Text
                    key={i}
                    style={{
                      color: colors.text2,
                      fontSize: 11,
                      lineHeight: 16,
                      marginBottom: i === (initial.recommendationExplanations || []).length - 1 ? 0 : 6,
                    }}
                  >
                    • {line}
                  </Text>
                ))}
              </View>
            )}
          </Card>
          {form.days.map((d, dIdx) => (
            <Card key={dIdx}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>{d.label}</Text>
              {d.exercises.map((e, j) => (
                <View key={j} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: j < d.exercises.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text2, fontSize: 12, flex: 1 }}>
                    {e.name} — {e.sets}×{e.reps}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Pressable onPress={() => moveExerciseInDay(dIdx, j, -1)} disabled={j === 0} hitSlop={6} style={{ opacity: j === 0 ? 0.3 : 1, padding: 4 }}>
                      <Feather name="chevron-up" size={16} color={colors.text2} />
                    </Pressable>
                    <Pressable onPress={() => moveExerciseInDay(dIdx, j, 1)} disabled={j === d.exercises.length - 1} hitSlop={6} style={{ opacity: j === d.exercises.length - 1 ? 0.3 : 1, padding: 4 }}>
                      <Feather name="chevron-down" size={16} color={colors.text2} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable onPress={() => setStep(2)} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.text2 }}>← Edit exercises</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                onCreate({
                  level: form.level,
                  phase: form.phase,
                  duration_weeks: form.duration_weeks,
                  days_per_week: form.days_per_week,
                  days: form.days,
                })
              }
              style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: colors.accentText, fontWeight: '700' }}>✅ Create mesocycle</Text>
            </Pressable>
          </View>
        </FadeIn>
      )}
    </View>
  );
}
