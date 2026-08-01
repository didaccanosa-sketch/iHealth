import React, { useCallback, useState } from 'react';
import {
  Text,
  View,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { MacroBar } from '../../components/MacroBar';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius, spacing } from '../../constants/theme';
import { Meal, MacroGoals } from '../../lib/engine/types';
import { computeMacroStatus, DEFAULT_GOALS, nutritionCoachLine } from '../../lib/engine/nutrition-engine';
import { groupMealsByDate } from '../../lib/engine/nutritionInsight';
import {
  fetchMealsForDate,
  fetchMealsForDateRange,
  fetchCurrentMacroGoal,
  saveMacroGoal,
  getNutritionInsight,
  insertMeal,
  updateMeal,
  deleteMeal,
  duplicateMeal,
  saveMealAsTemplate,
  analyzeMealText,
  fetchMealTemplates,
  deleteMealTemplate,
  MealTemplate,
  saveDayAsTemplate,
  fetchDayTemplates,
  applyDayTemplate,
  deleteDayTemplate,
  DayTemplate,
} from '../../lib/data/nutrition';
import { getStrategyRecommendation, explainRecommendation } from '../../lib/data/recommendation';
import type { StrategyPlan } from '../../lib/engine/recommendation-engine';

export default function NutritionScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [inputText, setInputText] = useState('');
  const [slot, setSlot] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTemplateIds, setSavedTemplateIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>([]);
  const [savingDayTemplate, setSavingDayTemplate] = useState(false);
  const [dayTemplateName, setDayTemplateName] = useState('');
  const [nutritionLine, setNutritionLine] = useState<string | null>(null);
  const [macroGoals, setMacroGoals] = useState<MacroGoals>(DEFAULT_GOALS);
  const [recommending, setRecommending] = useState(false);
  const [recommendedPlan, setRecommendedPlan] = useState<StrategyPlan | null>(null);
  const [recommendModalOpen, setRecommendModalOpen] = useState(false);
  const [applyingRecommendation, setApplyingRecommendation] = useState(false);
  const [showRecommendInfo, setShowRecommendInfo] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMealsForDate();
      setMeals(data);
      const tmpl = await fetchMealTemplates(userId);
      setTemplates(tmpl);
      const dayTmpl = await fetchDayTemplates(userId);
      setDayTemplates(dayTmpl);
      const savedGoal = await fetchCurrentMacroGoal(userId).catch(() => null);
      const goals = savedGoal ?? DEFAULT_GOALS;
      setMacroGoals(goals);

      // Frase de reglas fijas al instante; el Insight Engine con IA la sustituye
      // en segundo plano si responde a tiempo (mismo patrón que Today).
      const fallbackLine = nutritionCoachLine(computeMacroStatus(data, goals));
      setNutritionLine(fallbackLine);

      const todayStr = new Date().toISOString().slice(0, 10);
      const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      fetchMealsForDateRange(threeDaysAgoStr, todayStr)
        .then((recentMeals) =>
          getNutritionInsight(userId, data, groupMealsByDate(recentMeals), goals, fallbackLine)
        )
        .then((result) => setNutritionLine(result.line))
        .catch(() => {
          // ya tenemos el fallback puesto, no hace falta hacer nada más
        });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = computeMacroStatus(meals, macroGoals);
  const bySlot = groupBySlot(meals);
  const nextSlot = bySlot.length ? Math.max(...bySlot.map((g) => g.slot)) + 1 : 1;

  function openAddModal() {
    setEditingMeal(null);
    setInputText('');
    setSlot(nextSlot);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(meal: Meal) {
    setEditingMeal(meal);
    setInputText(meal.description);
    setSlot(meal.meal_slot);
    setError(null);
    setModalOpen(true);
  }

  async function handleAnalyzeAndSave() {
    if (!inputText.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeMealText(inputText.trim());
      if (editingMeal) {
        await updateMeal(editingMeal.id, {
          description: result.desc,
          kcal: result.kcal,
          protein_g: result.p,
          carbs_g: result.c,
          fat_g: result.f,
          fiber_g: result.fiber,
          meal_slot: slot,
        });
      } else {
        await insertMeal(userId, {
          description: result.desc,
          kcal: result.kcal,
          protein_g: result.p,
          carbs_g: result.c,
          fat_g: result.f,
          fiber_g: result.fiber,
          source: 'chat',
          meal_slot: slot,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not analyze this meal.');
    }
    setAnalyzing(false);
  }

  async function handleDelete(id: string) {
    try {
      await deleteMeal(id);
      await load();
    } catch (e: any) {
      console.error('Could not delete meal:', e);
      setError(e.message || 'Could not delete this meal.');
    }
  }

  async function handleDuplicate(meal: Meal) {
    try {
      await duplicateMeal(meal, userId, nextSlot);
      await load();
    } catch (e: any) {
      console.error('Could not duplicate meal:', e);
      setError(e.message || 'Could not duplicate this meal.');
    }
  }

  async function handleSaveTemplate(meal: Meal) {
    try {
      await saveMealAsTemplate(userId, meal);
      setSavedTemplateIds((prev) => new Set(prev).add(meal.id));
      setTimeout(() => {
        setSavedTemplateIds((prev) => {
          const next = new Set(prev);
          next.delete(meal.id);
          return next;
        });
      }, 2000);
      const tmpl = await fetchMealTemplates(userId);
      setTemplates(tmpl);
    } catch (e: any) {
      console.error('Could not save template:', e);
      setError(e.message || 'Could not save as template.');
    }
  }

  async function handleUseTemplate(tmpl: MealTemplate) {
    try {
      await insertMeal(userId, {
        description: tmpl.description,
        kcal: tmpl.kcal,
        protein_g: tmpl.protein_g,
        carbs_g: tmpl.carbs_g,
        fat_g: tmpl.fat_g,
        fiber_g: tmpl.fiber_g,
        source: 'template',
        meal_slot: slot,
      });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      console.error('Could not use template:', e);
      setError(e.message || 'Could not add this meal.');
    }
  }

  async function handleDeleteTemplate(id: string) {
    try {
      await deleteMealTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      console.error('Could not delete template:', e);
      setError(e.message || 'Could not delete this template.');
    }
  }

  async function handleSaveDayTemplate() {
    if (!dayTemplateName.trim()) return;
    try {
      await saveDayAsTemplate(userId, dayTemplateName.trim(), meals);
      setSavingDayTemplate(false);
      setDayTemplateName('');
      const dayTmpl = await fetchDayTemplates(userId);
      setDayTemplates(dayTmpl);
    } catch (e: any) {
      console.error('Could not save day template:', e);
      setError(e.message || 'Could not save this day as a template.');
    }
  }

  async function handleApplyDayTemplate(tmpl: DayTemplate) {
    try {
      await applyDayTemplate(userId, tmpl);
      await load();
    } catch (e: any) {
      console.error('Could not apply day template:', e);
      setError(e.message || 'Could not apply this template.');
    }
  }

  async function handleDeleteDayTemplate(id: string) {
    try {
      await deleteDayTemplate(id);
      setDayTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      console.error('Could not delete day template:', e);
      setError(e.message || 'Could not delete this template.');
    }
  }

  // La propuesta se enseña en una tarjeta dentro de la propia app (más abajo,
  // junto al Modal de comidas) — nada de diálogos nativos del navegador, que
  // se veían como un aviso suelto de "localhost" en vez de parte de la app.
  async function handleRecommend() {
    setRecommending(true);
    setError(null);
    setAiExplanation(null);
    try {
      const plan = await getStrategyRecommendation(userId);
      if (!plan) {
        setError('Primero fija un objetivo en Progress — sin eso el motor no tiene qué calcular.');
        return;
      }
      setRecommendedPlan(plan);
      setRecommendModalOpen(true);
    } catch (e: any) {
      setError(e.message || 'No se pudo calcular la recomendación, inténtalo de nuevo.');
    }
    setRecommending(false);
  }

  // Se pide solo al abrir el desplegable de info (no en cada recomendación)
  // — si falla, se queda el texto en español sencillo que ya había.
  function toggleRecommendInfo() {
    const next = !showRecommendInfo;
    setShowRecommendInfo(next);
    if (next && recommendedPlan && !aiExplanation && !explaining) {
      setExplaining(true);
      explainRecommendation('nutrition', recommendedPlan.explanations.nutrition)
        .then(setAiExplanation)
        .catch(() => {
          // se queda el fallback de viñetas, no hace falta avisar de esto
        })
        .finally(() => setExplaining(false));
    }
  }

  async function handleApplyRecommendation() {
    if (!recommendedPlan) return;
    setApplyingRecommendation(true);
    try {
      await saveMacroGoal(userId, recommendedPlan.nutrition, 'recommendation_engine');
      setMacroGoals(recommendedPlan.nutrition);
      setRecommendModalOpen(false);
      setRecommendedPlan(null);
      setShowRecommendInfo(false);
      setAiExplanation(null);
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar el objetivo, inténtalo de nuevo.');
    }
    setApplyingRecommendation(false);
  }

  return (
    <Screen title="Nutrition">
      <Card variant="glass">
        <MacroBar label="Calories" current={status.totals.kcal} goal={status.goals.kcal} unit="" color={colors.accent} />
        <MacroBar label="Protein" current={status.totals.protein_g} goal={status.goals.protein_g} unit="g" color={colors.vizProtein} />
        <MacroBar label="Carbs" current={status.totals.carbs_g} goal={status.goals.carbs_g} unit="g" color={colors.warning} />
        <MacroBar label="Fat" current={status.totals.fat_g} goal={status.goals.fat_g} unit="g" color={colors.vizFat} />
        <MacroBar label="Fiber" current={status.totals.fiber_g} goal={status.goals.fiber_g} unit="g" color={colors.success} />
        <Text style={{ color: colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
          {nutritionLine || nutritionCoachLine(status)}
        </Text>
        <Pressable
          onPress={handleRecommend}
          disabled={recommending}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, opacity: recommending ? 0.6 : 1 }}
        >
          {recommending ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Feather name="zap" size={13} color={colors.accent} />
          )}
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Recalcular con el motor</Text>
        </Pressable>
      </Card>

      {error && !modalOpen && (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 12 }}>{error}</Text>
      )}

      {meals.length > 0 && !savingDayTemplate && (
        <Pressable
          onPress={() => { setDayTemplateName(''); setSavingDayTemplate(true); }}
          style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Save this day as a template</Text>
        </Pressable>
      )}
      {savingDayTemplate && (
        <Card>
          <TextInput
            value={dayTemplateName}
            onChangeText={setDayTemplateName}
            placeholder="Template name (e.g. Training day)"
            placeholderTextColor={colors.text2}
            style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={handleSaveDayTemplate} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 13 }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setSavingDayTemplate(false)} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: colors.text2, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : bySlot.length === 0 ? (
        <>
          <Card>
            <Text style={{ color: colors.text2, fontSize: 13 }}>Nothing logged yet today.</Text>
          </Card>
          {dayTemplates.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Or apply a day template
              </Text>
              {dayTemplates.map((t) => (
                <Card key={t.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Pressable onPress={() => handleApplyDayTemplate(t)} style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t.name}</Text>
                      <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{t.meals.length} meals</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteDayTemplate(t.id)} hitSlop={8}>
                      <Feather name="trash-2" size={16} color={colors.text2} />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      ) : (
        bySlot.map((group) => (
          <View key={group.slot} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Meal {group.slot}
            </Text>
            {group.meals.map((meal) => (
              <Card key={meal.id}>
                <Pressable onPress={() => openEditModal(meal)}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>{meal.description}</Text>
                  <Text style={{ color: colors.text2, fontSize: 12 }}>
                    {Math.round(meal.kcal)} kcal · P {Math.round(meal.protein_g)}g · C {Math.round(meal.carbs_g)}g · F{' '}
                    {Math.round(meal.fat_g)}g · Fiber {Math.round(meal.fiber_g)}g
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                  <Pressable onPress={() => handleDuplicate(meal)} hitSlop={8}>
                    <Feather name="copy" size={16} color={colors.text2} />
                  </Pressable>
                  <Pressable onPress={() => handleSaveTemplate(meal)} hitSlop={8}>
                    <Feather
                      name={savedTemplateIds.has(meal.id) ? 'check' : 'bookmark'}
                      size={16}
                      color={savedTemplateIds.has(meal.id) ? colors.success : colors.text2}
                    />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(meal.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        ))
      )}

      <Pressable
        onPress={openAddModal}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radius.md,
          padding: 14,
          alignItems: 'center',
          marginTop: spacing.sm,
        }}
      >
        <Text style={{ color: colors.accentText, fontWeight: '700' }}>+ Add meal</Text>
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                padding: spacing.lg,
                paddingBottom: spacing.xl,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>
                {editingMeal ? 'Edit meal' : 'Add meal'}
              </Text>

              <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Meal slot</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {[...Array(nextSlot)].map((_, i) => {
                  const n = i + 1;
                  const isOn = n === slot;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setSlot(n)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: isOn ? colors.accent : colors.surface2,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: isOn ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>
                        Meal {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!editingMeal && templates.length > 0 && (
                <>
                  <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Or pick a saved meal</Text>
                  <ScrollView style={{ maxHeight: 160, marginBottom: 14 }}>
                    {templates.map((tmpl) => (
                      <View
                        key={tmpl.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.surface2,
                          borderRadius: radius.md,
                          padding: 10,
                          marginBottom: 6,
                        }}
                      >
                        <Pressable onPress={() => handleUseTemplate(tmpl)} style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{tmpl.description}</Text>
                          <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2 }}>
                            {Math.round(tmpl.kcal)} kcal · P {Math.round(tmpl.protein_g)}g · C {Math.round(tmpl.carbs_g)}g · F{' '}
                            {Math.round(tmpl.fat_g)}g
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => handleDeleteTemplate(tmpl.id)} hitSlop={8} style={{ paddingLeft: 10 }}>
                          <Feather name="trash-2" size={15} color={colors.text2} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                  <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Or describe it</Text>
                </>
              )}

              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="What did you eat? E.g. a plate of pasta with tuna and tomato..."
                placeholderTextColor={colors.text2}
                multiline
                style={{
                  backgroundColor: colors.surface2,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 12,
                  color: colors.text,
                  minHeight: 70,
                  textAlignVertical: 'top',
                  marginBottom: 10,
                }}
              />

              {error && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 10 }}>{error}</Text>}

              <Pressable
                onPress={handleAnalyzeAndSave}
                disabled={analyzing}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: radius.md,
                  padding: 14,
                  alignItems: 'center',
                  marginBottom: 8,
                  opacity: analyzing ? 0.6 : 1,
                }}
              >
                {analyzing ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Text style={{ color: colors.accentText, fontWeight: '700' }}>Analyze with AI</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setModalOpen(false)} style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ color: colors.text2 }}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={recommendModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRecommendModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Objetivo propuesto</Text>
              <Pressable onPress={toggleRecommendInfo} hitSlop={8}>
                <Feather name="info" size={15} color={colors.text2} />
              </Pressable>
            </View>
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: showRecommendInfo ? 8 : 16 }}>
              Calculado por el motor a partir de tu objetivo actual — revisa antes de aplicar.
            </Text>

            {showRecommendInfo && recommendedPlan && (
              <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, marginBottom: 16 }}>
                {explaining ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : aiExplanation ? (
                  <Text style={{ color: colors.text2, fontSize: 12, lineHeight: 18 }}>{aiExplanation}</Text>
                ) : (
                  recommendedPlan.explanations.nutrition.map((line, i) => (
                    <Text
                      key={i}
                      style={{ color: colors.text2, fontSize: 11, lineHeight: 16, marginBottom: i === recommendedPlan.explanations.nutrition.length - 1 ? 0 : 6 }}
                    >
                      • {line}
                    </Text>
                  ))
                )}
              </View>
            )}

            {recommendedPlan && (
              <View style={{ marginBottom: 20 }}>
                {[
                  { label: 'Calorías', value: `${recommendedPlan.nutrition.kcal} kcal` },
                  { label: 'Proteína', value: `${recommendedPlan.nutrition.protein_g} g` },
                  { label: 'Carbohidratos', value: `${recommendedPlan.nutrition.carbs_g} g` },
                  { label: 'Grasa', value: `${recommendedPlan.nutrition.fat_g} g` },
                  { label: 'Fibra', value: `${recommendedPlan.nutrition.fiber_g} g` },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text2, fontSize: 13 }}>{row.label}</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => {
                  setRecommendModalOpen(false);
                  setRecommendedPlan(null);
                  setShowRecommendInfo(false);
                  setAiExplanation(null);
                }}
                disabled={applyingRecommendation}
                style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyRecommendation}
                disabled={applyingRecommendation}
                style={{
                  flex: 1,
                  backgroundColor: colors.accent,
                  borderRadius: radius.md,
                  padding: 12,
                  alignItems: 'center',
                  opacity: applyingRecommendation ? 0.6 : 1,
                }}
              >
                {applyingRecommendation ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Text style={{ color: colors.accentText, fontWeight: '700' }}>Aplicar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function groupBySlot(meals: Meal[]): { slot: number; meals: Meal[] }[] {
  const map = new Map<number, Meal[]>();
  meals.forEach((m) => {
    const list = map.get(m.meal_slot) || [];
    list.push(m);
    map.set(m.meal_slot, list);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slot, meals]) => ({ slot, meals }));
}
