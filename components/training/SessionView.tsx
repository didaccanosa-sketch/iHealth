import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';
import { Mesocycle, MesoSession } from '../../lib/engine/types';
import { getSessionDef, computeWeekRIR, suggestProgression, totalSessions } from '../../lib/engine/workout-engine';

const PHASE_LABEL: Record<string, string> = { volumen: 'Volume', mantenimiento: 'Maintenance', definicion: 'Cut' };
const LEVEL_LABEL: Record<string, string> = { principiante: 'Beginner', avanzado: 'Advanced' };
const JOINTS = ['Shoulder', 'Elbow', 'Wrist', 'Knee', 'Hip', 'Lower back', 'Other'];

export type SessionFeedback = {
  difficulty: 'facil' | 'normal' | 'dificil' | 'limite';
  joint_pain: boolean;
  joint: string | null;
  sore_exercise: string | null;
  note: string;
};

function SetRow({
  initialKg,
  initialReps,
  editable,
  onSave,
}: {
  initialKg: string;
  initialReps: string;
  editable: boolean;
  onSave: (kg: string, reps: string) => void;
}) {
  const { colors } = useAppTheme();
  const [kg, setKg] = useState(initialKg);
  const [reps, setReps] = useState(initialReps);

  return (
    <>
      <TextInput
        value={kg}
        onChangeText={setKg}
        onBlur={() => onSave(kg, reps)}
        editable={editable}
        keyboardType="decimal-pad"
        placeholder="kg"
        placeholderTextColor={colors.text2}
        style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: 10, padding: 9, color: colors.text, textAlign: 'center' }}
      />
      <TextInput
        value={reps}
        onChangeText={setReps}
        onBlur={() => onSave(kg, reps)}
        editable={editable}
        keyboardType="number-pad"
        placeholder="reps"
        placeholderTextColor={colors.text2}
        style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: 10, padding: 9, color: colors.text, textAlign: 'center' }}
      />
    </>
  );
}

export function SessionView({
  meso,
  sessions,
  viewingIndex,
  onViewSession,
  onSaveSet,
  onCompleteSession,
  onEndEarly,
  onBack,
  onDuplicate,
  onSaveTemplate,
  overrides,
  onChangeSets,
}: {
  meso: Mesocycle;
  sessions: Record<number, MesoSession>;
  viewingIndex: number;
  onViewSession: (i: number) => void;
  onSaveSet: (exerciseId: string, setIndex: number, kg: string, reps: string) => void;
  onCompleteSession: (feedback: SessionFeedback) => void;
  onEndEarly: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onSaveTemplate: (name: string) => void;
  overrides?: Record<string, number>;
  onChangeSets: (exerciseId: string, currentSets: number, delta: number) => void;
}) {
  const { colors } = useAppTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [feedback, setFeedback] = useState<SessionFeedback>({ difficulty: 'normal', joint_pain: false, joint: null, sore_exercise: null, note: '' });

  const total = totalSessions(meso);
  const sessDef = getSessionDef(meso, viewingIndex, overrides);
  const isCurrent = !meso.finished && viewingIndex === meso.current_index;
  const isFuture = !meso.finished && viewingIndex > meso.current_index;
  const sessionData = sessions[viewingIndex];

  const perWeek = meso.days_per_week;
  const totalWeeks = meso.duration_weeks + 1;
  const curWeek = Math.floor(viewingIndex / perWeek) + 1;

  function getSetValue(exId: string, setIdx: number, field: 'kg' | 'reps'): string {
    const set = sessionData?.sets.find((s) => s.exercise_id === exId && s.set_index === setIdx);
    const v = set ? set[field] : null;
    return v == null ? '' : String(v);
  }

  function openFeedback() {
    setFeedback({ difficulty: 'normal', joint_pain: false, joint: null, sore_exercise: null, note: '' });
    setFeedbackOpen(true);
  }

  return (
    <View>
      <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, marginBottom: 14 }}>
        <Feather name="chevron-left" size={16} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Mesocycles</Text>
      </Pressable>

      {meso.finished && (
        <Card variant="glass">
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>Mesocycle completed</Text>
          <Text style={{ color: colors.text2, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            {meso.duration_weeks} weeks + deload · {PHASE_LABEL[meso.phase]} · {LEVEL_LABEL[meso.level]}
          </Text>
          <Pressable onPress={onDuplicate} style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Duplicate this mesocycle</Text>
          </Pressable>
          {!savingTemplate ? (
            <Pressable onPress={() => { setTemplateName(''); setSavingTemplate(true); }} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Save as template</Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: 10 }}>
              <TextInput
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Template name"
                placeholderTextColor={colors.text2}
                style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => { if (templateName.trim()) { onSaveTemplate(templateName.trim()); setSavingTemplate(false); } }}
                  style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 13 }}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setSavingTemplate(false)} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, alignItems: 'center' }}>
                  <Text style={{ color: colors.text2, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Card>
      )}

      {!meso.finished && (
        <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.surface2, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.round((meso.current_index / total) * 100)}%`, backgroundColor: colors.accent }} />
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
          const isDeloadW = w === meso.duration_weeks + 1;
          const on = w === curWeek;
          return (
            <Pressable
              key={w}
              onPress={() => onViewSession((w - 1) * perWeek)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? colors.accent : colors.surface2, marginRight: 6 }}
            >
              <Text style={{ color: on ? colors.accentText : colors.text2, fontSize: 12, fontWeight: '600' }}>
                {isDeloadW ? 'Deload' : `Week ${w}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {Array.from({ length: perWeek }, (_, d) => {
          const sIdx = (curWeek - 1) * perWeek + d;
          if (sIdx >= total) return null;
          const done = sessions[sIdx]?.completed;
          const on = sIdx === viewingIndex;
          return (
            <Pressable
              key={d}
              onPress={() => onViewSession(sIdx)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? colors.accent : colors.surface2, marginRight: 6 }}
            >
              <Text style={{ color: on ? colors.accentText : colors.text2, fontSize: 12, fontWeight: '600' }}>
                {done ? '✓ ' : ''}D{d + 1}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card variant="glass">
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{sessDef.dayLabel}</Text>
        <Text style={{ color: sessDef.isDeload ? colors.warning : colors.text2, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
          Week {sessDef.week}
          {sessDef.isDeload ? ' · DELOAD' : ''} · Session {viewingIndex + 1}/{total}
        </Text>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
          {sessDef.isDeload ? 'High RIR (4-5) · Deload' : `Target RIR: ${computeWeekRIR(sessDef.week, meso.duration_weeks, meso.level)}`}
        </Text>
      </Card>

      {sessDef.exercises.map((ex) => {
        const suggestion = isFuture ? null : suggestProgression(meso, sessions, ex.id, ex.reps, viewingIndex, sessDef.isDeload);
        const isPR = sessionData?.sets.some((s) => s.exercise_id === ex.id && s.is_pr);
        return (
          <Card key={ex.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }}>
                {ex.name}
                {isPR ? ' 🏆' : ''}
              </Text>
              {isCurrent ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => onChangeSets(ex.id, ex.sets, -1)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>−</Text>
                  </Pressable>
                  <Text style={{ color: colors.text2, fontSize: 12 }}>
                    {ex.sets}×{ex.reps}
                  </Text>
                  <Pressable onPress={() => onChangeSets(ex.id, ex.sets, 1)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>+</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={{ color: colors.text2, fontSize: 12 }}>
                  {ex.sets}×{ex.reps}
                </Text>
              )}
            </View>
            {suggestion && <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}>{suggestion.text}</Text>}
            {isFuture ? (
              <Text style={{ color: colors.text2, fontSize: 12, marginTop: 8 }}>Not your turn yet — preview only</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {Array.from({ length: ex.sets }, (_, i) => i).map((i) => (
                  <View key={`${viewingIndex}-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ color: colors.text2, fontSize: 12, width: 16, textAlign: 'center' }}>{i + 1}</Text>
                    <SetRow
                      initialKg={getSetValue(ex.id, i, 'kg')}
                      initialReps={getSetValue(ex.id, i, 'reps')}
                      editable={isCurrent}
                      onSave={(kg, reps) => onSaveSet(ex.id, i, kg, reps)}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {isCurrent && (
        <Pressable onPress={openFeedback} style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: colors.accentText, fontWeight: '700' }}>
            Complete session{viewingIndex + 1 === total ? ' (last)' : ''}
          </Text>
        </Pressable>
      )}

      <Modal visible={feedbackOpen} animationType="slide" onRequestClose={() => setFeedbackOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 60 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 20, marginBottom: 16 }}>How did the session go?</Text>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Overall difficulty</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              ['facil', 'Very easy'],
              ['normal', 'Normal'],
              ['dificil', 'Hard'],
              ['limite', 'At the limit'],
            ].map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => setFeedback((f) => ({ ...f, difficulty: id as SessionFeedback['difficulty'] }))}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: feedback.difficulty === id ? colors.accent : colors.surface2, marginRight: 6, marginBottom: 6 }}
              >
                <Text style={{ color: feedback.difficulty === id ? colors.accentText : colors.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Joint pain?</Text>
          <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            <Pressable onPress={() => setFeedback((f) => ({ ...f, joint_pain: false, joint: null }))} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: !feedback.joint_pain ? colors.accent : colors.surface2, marginRight: 6 }}>
              <Text style={{ color: !feedback.joint_pain ? colors.accentText : colors.text2, fontSize: 12, fontWeight: '600' }}>No</Text>
            </Pressable>
            <Pressable onPress={() => setFeedback((f) => ({ ...f, joint_pain: true }))} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: feedback.joint_pain ? colors.accent : colors.surface2 }}>
              <Text style={{ color: feedback.joint_pain ? colors.accentText : colors.text2, fontSize: 12, fontWeight: '600' }}>Yes</Text>
            </Pressable>
          </View>
          {feedback.joint_pain && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {JOINTS.map((j) => (
                <Pressable key={j} onPress={() => setFeedback((f) => ({ ...f, joint: j }))} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, backgroundColor: feedback.joint === j ? colors.accent : colors.surface2, marginRight: 6 }}>
                  <Text style={{ color: feedback.joint === j ? colors.accentText : colors.text2, fontSize: 12 }}>{j}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <TextInput
            value={feedback.note}
            onChangeText={(v) => setFeedback((f) => ({ ...f, note: v }))}
            placeholder="Optional note"
            placeholderTextColor={colors.text2}
            style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
          />

          <Pressable onPress={() => { onCompleteSession(feedback); setFeedbackOpen(false); }} style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Save and complete session</Text>
          </Pressable>
          <Pressable onPress={() => setFeedbackOpen(false)} style={{ padding: 10, alignItems: 'center' }}>
            <Text style={{ color: colors.text2 }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {!isCurrent && !meso.finished && viewingIndex < meso.current_index && (
        <Text style={{ color: colors.text2, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Viewing a completed session</Text>
      )}

      {!meso.finished && (
        <Pressable onPress={onEndEarly} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center', marginTop: 10 }}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>End mesocycle early</Text>
        </Pressable>
      )}
    </View>
  );
}
