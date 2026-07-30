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
import { Meal } from '../../lib/engine/types';
import { computeMacroStatus, DEFAULT_GOALS, nutritionCoachLine } from '../../lib/engine/nutrition-engine';
import {
  fetchMealsForDate,
  insertMeal,
  updateMeal,
  deleteMeal,
  duplicateMeal,
  saveMealAsTemplate,
  analyzeMealText,
} from '../../lib/data/nutrition';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMealsForDate();
      setMeals(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = computeMacroStatus(meals, DEFAULT_GOALS);
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
    } catch (e: any) {
      console.error('Could not save template:', e);
      setError(e.message || 'Could not save as template.');
    }
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
          {nutritionCoachLine(status)}
        </Text>
      </Card>

      {error && !modalOpen && (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 12 }}>{error}</Text>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : bySlot.length === 0 ? (
        <Card>
          <Text style={{ color: colors.text2, fontSize: 13 }}>Nothing logged yet today.</Text>
        </Card>
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
