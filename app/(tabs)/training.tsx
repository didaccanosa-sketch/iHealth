import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { FadeIn } from '../../components/FadeIn';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { MesoMenu } from '../../components/training/MesoMenu';
import { MesoWizard } from '../../components/training/MesoWizard';
import { SessionView, SessionFeedback } from '../../components/training/SessionView';
import { ProgramScreen } from '../../components/training/ProgramScreen';
import { CreateMesoChooser } from '../../components/training/CreateMesoChooser';
import { DraftPreview } from '../../components/training/DraftPreview';
import { TemplatePicker } from '../../components/training/TemplatePicker';
import { CardioScreen } from '../../components/training/CardioScreen';
import {
  fetchMesocycles,
  fetchMesocycleDetail,
  fetchSessions,
  fetchSessionOverrides,
  setSessionOverride,
  updateExerciseSetsGlobal,
  createMesocycle,
  duplicateMesocycle,
  deleteMesocycle,
  startMesocycle,
  saveSet,
  checkAndRecordPR,
  completeSession as dataCompleteSession,
  advanceMesocycle,
  endMesocycleEarly,
  saveMesoAsTemplate,
  MesoSummary,
  NewMesoInput,
} from '../../lib/data/workout';
import { Mesocycle, MesoSession } from '../../lib/engine/types';
import { totalSessions, estimate1RM } from '../../lib/engine/workout-engine';
import { buildFocusSplit } from '../../lib/engine/meso-templates';
import { getStrategyRecommendation } from '../../lib/data/recommendation';
import { consumePendingWorkoutDraft } from '../../lib/data/pending-workout-draft';

type View = 'program' | 'menu' | 'createChoice' | 'templatePicker' | 'wizard' | 'session' | 'cardio';

export default function TrainingScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [view, setView] = useState<View>('program');
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [mesos, setMesos] = useState<MesoSummary[]>([]);

  const [wizardInitial, setWizardInitial] = useState<NewMesoInput | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [sessions, setSessions] = useState<Record<number, MesoSession>>({});
  const [viewingIndex, setViewingIndex] = useState<number>(0);
  const [loadingMeso, setLoadingMeso] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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
      if (view === 'menu' || view === 'program') loadMenu();
    }, [view, loadMenu])
  );

  // Enlace directo desde la tarjeta "YOUR PLAN" de la pantalla única
  // (router.push('/training?open=active')) — abre el mesociclo activo
  // directo en su sesión de hoy, sin el toque extra sobre ProgramScreen.
  const params = useLocalSearchParams<{ open?: string }>();
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || params.open !== 'active' || loadingMenu) return;
    const active = mesos.find((m) => m.started && !m.finished);
    if (active) {
      autoOpenedRef.current = true;
      openMeso(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, mesos, loadingMenu]);

  // Enlace desde la propuesta de rutina del chat — llega con un borrador ya
  // generado (ver lib/data/pending-workout-draft.ts) y se abre directo en el
  // wizard, en el paso de revisión (MesoWizard salta a "step 3" cuando
  // recibe "initial"), para que el usuario pueda editar ejercicios/sets/reps
  // antes de crear nada. Nunca se crea sin pasar por aquí.
  const wizardDraftOpenedRef = useRef(false);
  useEffect(() => {
    if (wizardDraftOpenedRef.current || params.open !== 'wizard') return;
    const draft = consumePendingWorkoutDraft();
    if (draft) {
      wizardDraftOpenedRef.current = true;
      setWizardInitial(draft);
      setView('wizard');
    }
  }, [params.open]);

  async function openMeso(id: string) {
    setSelectedId(id);
    setLoadingMeso(true);
    setMesoError(null);
    setStartError(null);
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

  async function handleStartMeso() {
    if (!meso) return;
    try {
      await startMesocycle(meso.id, userId);
      const detail = await fetchMesocycleDetail(meso.id);
      setMeso(detail);
    } catch (e: any) {
      setStartError(e.message || 'Could not start this mesocycle.');
    }
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
            console.error('Could not update sets:', e);
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
            console.error('Could not update sets:', e);
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
      console.error('Could not save:', e);
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
      console.error('Could not complete session:', e);
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
      console.error('Could not end mesocycle:', e);
      Alert.alert('Could not end mesocycle', e.message || 'Unknown error.');
    }
  }

  async function handleDeleteMeso(id: string) {
    try {
      await deleteMesocycle(id, userId);
      await loadMenu();
    } catch (e: any) {
      console.error('Could not delete mesocycle:', e);
      setMenuError(e.message || 'Could not delete this mesocycle.');
    }
  }

  async function handleDuplicate() {
    if (!meso) return;
    try {
      const input = await duplicateMesocycle(meso.id, userId);
      setWizardInitial(input);
      setView('wizard');
    } catch (e: any) {
      console.error('Could not duplicate mesocycle:', e);
      Alert.alert('Could not duplicate mesocycle', e.message || 'Unknown error.');
    }
  }

  async function handleSaveAsTemplate(name: string) {
    if (!meso) return;
    try {
      await saveMesoAsTemplate(meso.id, userId, name);
      Alert.alert('Saved', 'Template saved — find it under "My templates" next time you create a mesocycle.');
    } catch (e: any) {
      console.error('Could not save template:', e);
      Alert.alert('Could not save template', e.message || 'Unknown error.');
    }
  }

  async function handleCreateMeso(input: NewMesoInput) {
    try {
      const id = await createMesocycle(userId, input);
      setWizardInitial(null);
      await openMeso(id);
    } catch (e: any) {
      console.error('Could not create mesocycle:', e);
      Alert.alert('Could not create mesocycle', e.message || 'Unknown error.');
    }
  }

  function handlePickTemplate(input: NewMesoInput) {
    setWizardInitial(input);
    setView('wizard');
  }

  // El aviso de "sin objetivo" o de error se muestra dentro de la propia
  // pantalla (recommendError, más abajo) — nada de Alert.alert nativo aquí:
  // en web se veía como un aviso suelto de "localhost" en vez de parte de
  // la app (mismo arreglo que en Nutrition).
  async function handleRecommend() {
    setRecommending(true);
    setRecommendError(null);
    try {
      const plan = await getStrategyRecommendation(userId);
      if (!plan) {
        setRecommendError('Primero fija un objetivo en Progress — sin eso el motor no tiene qué calcular.');
        return;
      }
      // El split día a día lo sigue generando el propio Workout Engine
      // (sin prioridad de grupo muscular en esta pasada, ver
      // docs/RECOMMENDATION_ENGINE.md) — el motor solo decide días/fase/nivel.
      setWizardInitial({
        level: plan.training.level,
        phase: plan.training.phase ?? 'mantenimiento',
        duration_weeks: 6,
        days_per_week: plan.training.daysPerWeek,
        days: buildFocusSplit(plan.training.daysPerWeek, []),
        generatedFrom: 'recommendation',
        recommendationExplanations: plan.explanations.training,
      });
      setView('wizard');
    } catch (e: any) {
      console.error('Could not compute recommendation:', e);
      setRecommendError(e.message || 'No se pudo calcular la recomendación, inténtalo de nuevo.');
    }
    setRecommending(false);
  }

  const hasActiveMeso = mesos.some((m) => m.started && !m.finished && m.id !== selectedId);

  return (
    <Screen title="Training">
      <FadeIn trigger={view}>
      {view === 'program' && menuError && (
        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{menuError}</Text>
      )}
      {view === 'program' && (
        <ProgramScreen
          loading={loadingMenu}
          mesos={mesos}
          onContinue={openMeso}
          onCreate={() => setView('createChoice')}
          onHistory={() => setView('menu')}
          onCardio={() => setView('cardio')}
        />
      )}

      {view === 'cardio' && <CardioScreen onBack={() => setView('program')} />}

      {view === 'menu' && menuError && (
        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{menuError}</Text>
      )}
      {view === 'menu' && (
        <MesoMenu
          loading={loadingMenu}
          mesos={mesos}
          onSelect={openMeso}
          onCreate={() => setView('createChoice')}
          onDelete={handleDeleteMeso}
          onBack={() => setView('program')}
        />
      )}

      {view === 'createChoice' && (
        <>
          {recommendError && (
            <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{recommendError}</Text>
          )}
          <CreateMesoChooser
            onFromScratch={() => {
              setWizardInitial(null);
              setView('wizard');
            }}
            onUseTemplate={() => setView('templatePicker')}
            onRecommend={handleRecommend}
            recommending={recommending}
            onCancel={() => setView('menu')}
          />
        </>
      )}

      {view === 'templatePicker' && (
        <TemplatePicker onPick={handlePickTemplate} onCancel={() => setView('createChoice')} />
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
        ) : !meso.started && !meso.finished ? (
          <DraftPreview
            meso={meso}
            blockedReason={hasActiveMeso ? 'You already have a mesocycle in progress. Finish or end it before starting this one.' : startError}
            onStart={handleStartMeso}
            onBack={() => setView('menu')}
          />
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
            onSaveTemplate={handleSaveAsTemplate}
            overrides={overridesMap[viewingIndex]}
            onChangeSets={handleChangeSets}
          />
        ))}
      </FadeIn>
    </Screen>
  );
}
