import React, { useCallback, useState } from 'react';
import { Text, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { MesoMenu } from '../../components/training/MesoMenu';
import { MesoWizard } from '../../components/training/MesoWizard';
import { SessionView, SessionFeedback } from '../../components/training/SessionView';
import {
  fetchMesocycles,
  fetchMesocycleDetail,
  fetchSessions,
  fetchSessionOverrides,
  setSessionOverride,
  updateExerciseSetsGlobal,
  createMesocycle,
  duplicateMesocycle,
  saveSet,
  checkAndRecordPR,
  completeSession as dataCompleteSession,
  advanceMesocycle,
  endMesocycleEarly,
  MesoSummary,
  NewMesoInput,
} from '../../lib/data/workout';
import { Mesocycle, MesoSession } from '../../lib/engine/types';
import { totalSessions, estimate1RM } from '../../lib/engine/workout-engine';

type View = 'menu' | 'wizard' | 'session';

export default function TrainingScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [view, setView] = useState<View>('menu');
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [mesos, setMesos] = useState<MesoSummary[]>([]);

  const [wizardInitial, setWizardInitial] = useState<NewMesoInput | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [sessions, setSessions] = useState<Record<number, MesoSession>>({});
  const [viewingIndex, setViewingIndex] = useState<number>(0);
  const [loadingMeso, setLoadingMeso] = useState(false);

  const [menuError, setMenuError] = useState<string | null>(null);
  const [mesoError, setMesoError] = useState<string | null>(null);
  const [overridesMap, setOverridesMap] = useState<Record<number, Record<string, number>>>({});

  const loadMenu = useCallback(async () => {
    setLoadingMenu(true);
    setMenuError(null);
    try {
      const data = await fetchMesocycles(userId);
      setMesos(data);
    } catch (e: any) {
      setMenuError(e.message || 'Could not load your mesocycles.');
    }
    setLoadingMenu(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (view === 'menu') loadMenu();
    }, [view, loadMenu])
  );

  async function openMeso(id: string) {
    setSelectedId(id);
    setLoadingMeso(true);
    setMesoError(null);
    setView('session');
    try {
      const detail = await fetchMesocycleDetail(id);
      const sess = await fetchSessions(id, userId);
      const overrides = await fetchSessionOverrides(id, userId);
      setMeso(detail);
      setSessions(sess);
      setOverridesMap(overrides);
      setViewingIndex(detail.finished ? totalSessions(detail) - 1 : detail.current_index);
    } catch (e: any) {
      setMesoError(e.message || 'Could not load this mesocycle.');
    }
    setLoadingMeso(false);
  }

  function handleChangeSets(exerciseId: string, currentSets: number, delta: number) {
    if (!meso) return;
    const newCount = Math.max(1, currentSets + delta);
    Alert.alert('Update sets', 'Apply this change to:', [
      {
        text: 'Just this session',
        onPress: async () => {
          try {
            await setSessionOverride(meso.id, userId, viewingIndex, exerciseId, newCount);
            const overrides = await fetchSessionOverrides(meso.id, userId);
            setOverridesMap(overrides);
          } catch (e: any) {
            Alert.alert('Could not update sets', e.message || 'Unknown error.');
          }
        },
      },
      {
        text: 'Whole mesocycle',
        onPress: async () => {
          try {
            await updateExerciseSetsGlobal(exerciseId, userId, newCount);
            const detail = await fetchMesocycleDetail(meso.id);
            setMeso(detail);
          } catch (e: any) {
            Alert.alert('Could not update sets', e.message || 'Unknown error.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function findExerciseName(exId: string): string {
    if (!meso) return exId;
    for (const d of meso.days) {
      const found = d.exercises.find((e) => e.id === exId);
      if (found) return found.name;
    }
    return exId;
  }

  async function handleSaveSet(exId: string, setIdx: number, kgStr: string, repsStr: string) {
    if (!meso) return;
    const kg = kgStr ? parseFloat(kgStr) : null;
    const reps = repsStr ? parseInt(repsStr) : null;
    try {
      let isPR = false;
      if (kg && reps) {
        const est = estimate1RM(kg, reps);
        isPR = await checkAndRecordPR(userId, findExerciseName(exId), kg, reps, est);
      }
      await saveSet(meso.id, userId, viewingIndex, exId, setIdx, { kg, reps, is_pr: isPR });
      const updated = await fetchSessions(meso.id, userId);
      setSessions(updated);
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Unknown error while saving this set.');
    }
  }

  async function handleCompleteSession(feedback: SessionFeedback) {
    if (!meso) return;
    try {
      await dataCompleteSession(meso.id, userId, viewingIndex, {
        difficulty: feedback.difficulty,
        joint_pain: feedback.joint_pain,
        joint: feedback.joint,
        sore_exercise: feedback.sore_exercise,
        note: feedback.note || null,
      });
      const total = totalSessions(meso);
      const isLast = viewingIndex + 1 >= total;
      await advanceMesocycle(meso.id, isLast ? meso.current_index : viewingIndex + 1, isLast);
      const detail = await fetchMesocycleDetail(meso.id);
      const sess = await fetchSessions(meso.id, userId);
      setMeso(detail);
      setSessions(sess);
      setViewingIndex(isLast ? total - 1 : viewingIndex + 1);
    } catch (e: any) {
      Alert.alert('Could not complete session', e.message || 'Unknown error.');
    }
  }

  async function handleEndEarly() {
    if (!meso) return;
    try {
      await endMesocycleEarly(meso.id);
      setView('menu');
      setMeso(null);
      setSelectedId(null);
    } catch (e: any) {
      Alert.alert('Could not end mesocycle', e.message || 'Unknown error.');
    }
  }

  async function handleDuplicate() {
    if (!meso) return;
    try {
      const input = await duplicateMesocycle(meso.id, userId);
      setWizardInitial(input);
      setView('wizard');
    } catch (e: any) {
      Alert.alert('Could not duplicate mesocycle', e.message || 'Unknown error.');
    }
  }

  async function handleCreateMeso(input: NewMesoInput) {
    try {
      const id = await createMesocycle(userId, input);
      setWizardInitial(null);
      await openMeso(id);
    } catch (e: any) {
      Alert.alert('Could not create mesocycle', e.message || 'Unknown error.');
    }
  }

  return (
    <Screen title="Training">
      {view === 'menu' && menuError && (
        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{menuError}</Text>
      )}
      {view === 'menu' && (
        <MesoMenu
          loading={loadingMenu}
          mesos={mesos}
          onSelect={openMeso}
          onCreate={() => {
            setWizardInitial(null);
            setView('wizard');
          }}
        />
      )}

      {view === 'wizard' && (
        <MesoWizard
          initial={wizardInitial}
          onCancel={() => setView('menu')}
          onCreate={handleCreateMeso}
        />
      )}

      {view === 'session' && mesoError && (
        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{mesoError}</Text>
      )}
      {view === 'session' &&
        !mesoError &&
        (loadingMeso || !meso ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : (
          <SessionView
            meso={meso}
            sessions={sessions}
            viewingIndex={viewingIndex}
            onViewSession={setViewingIndex}
            onSaveSet={handleSaveSet}
            onCompleteSession={handleCompleteSession}
            onEndEarly={handleEndEarly}
            onBack={() => setView('menu')}
            onDuplicate={handleDuplicate}
            overrides={overridesMap[viewingIndex]}
            onChangeSets={handleChangeSets}
          />
        ))}
    </Screen>
  );
}
