import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius, spacing } from '../../constants/theme';
import { CardioSession, totalKcal, weeklyBars, monthlyBars, sessionsThisWeek } from '../../lib/engine/cardio-engine';
import {
  fetchCardioSessions,
  insertCardioSession,
  deleteCardioSession,
  duplicateCardioSession,
  saveCardioAsTemplate,
  analyzeCardioText,
} from '../../lib/data/cardio';

export function CardioScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [modalOpen, setModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCardioSessions(userId);
      setSessions(data);
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

  const thisWeek = sessionsThisWeek(sessions);
  const bars = range === 'week' ? weeklyBars(sessions) : monthlyBars(sessions);
  const maxKcal = Math.max(1, ...bars.map((b) => b.kcal));

  async function handleAnalyzeAndSave() {
    if (!inputText.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCardioText(inputText.trim());
      await insertCardioSession(userId, {
        description: result.desc,
        activity_type: result.activity_type || null,
        duration_min: result.duration_min || null,
        distance_km: result.distance_km || null,
        kcal: result.kcal || 0,
        avg_heart_rate: result.avg_heart_rate || null,
      });
      setInputText('');
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not analyze this session.');
    }
    setAnalyzing(false);
  }

  async function handleDelete(id: string) {
    try {
      await deleteCardioSession(id);
      await load();
    } catch (e: any) {
      console.error('Could not delete session:', e);
      setError(e.message || 'Could not delete this session.');
    }
  }

  async function handleDuplicate(s: CardioSession) {
    try {
      await duplicateCardioSession(s, userId);
      await load();
    } catch (e: any) {
      console.error('Could not duplicate session:', e);
      setError(e.message || 'Could not duplicate this session.');
    }
  }

  async function handleSaveTemplate(s: CardioSession) {
    try {
      await saveCardioAsTemplate(userId, s);
      setSavedIds((prev) => new Set(prev).add(s.id));
      setTimeout(() => {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(s.id);
          return next;
        });
      }, 2000);
    } catch (e: any) {
      console.error('Could not save template:', e);
      setError(e.message || 'Could not save as template.');
    }
  }

  return (
    <View>
      <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, marginBottom: 14 }}>
        <Feather name="chevron-left" size={16} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Training type</Text>
      </Pressable>

      <Card variant="glass">
        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>This week</Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{Math.round(totalKcal(thisWeek))} kcal</Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>
          {thisWeek.length} session{thisWeek.length === 1 ? '' : 's'}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, marginBottom: 14 }}>
        <Pressable
          onPress={() => setRange('week')}
          style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: range === 'week' ? colors.accent : 'transparent' }}
        >
          <Text style={{ color: range === 'week' ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>Week</Text>
        </Pressable>
        <Pressable
          onPress={() => setRange('month')}
          style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: range === 'month' ? colors.accent : 'transparent' }}
        >
          <Text style={{ color: range === 'month' ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>Month</Text>
        </Pressable>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 6 }}>
          {bars.map((b, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '100%', height: Math.max((b.kcal / maxKcal) * 50, 2), backgroundColor: b.kcal > 0 ? colors.accent : colors.border, borderRadius: 3 }} />
              <Text style={{ color: colors.text2, fontSize: 10 }}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {error && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 12 }}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : !sessions.length ? (
        <Card>
          <Text style={{ color: colors.text2, fontSize: 13 }}>No cardio sessions logged yet.</Text>
        </Card>
      ) : (
        sessions.map((s) => (
          <Card key={s.id}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{s.description}</Text>
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 4 }}>
              {s.logged_at} · {Math.round(s.kcal)} kcal
              {s.duration_min ? ` · ${s.duration_min} min` : ''}
              {s.distance_km ? ` · ${s.distance_km} km` : ''}
              {s.avg_heart_rate ? ` · ${s.avg_heart_rate} bpm avg` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              <Pressable onPress={() => handleDuplicate(s)} hitSlop={8}>
                <Feather name="copy" size={16} color={colors.text2} />
              </Pressable>
              <Pressable onPress={() => handleSaveTemplate(s)} hitSlop={8}>
                <Feather name={savedIds.has(s.id) ? 'check' : 'bookmark'} size={16} color={savedIds.has(s.id) ? colors.success : colors.text2} />
              </Pressable>
              <Pressable onPress={() => handleDelete(s.id)} hitSlop={8}>
                <Feather name="trash-2" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <Pressable
        onPress={() => setModalOpen(true)}
        style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: 4 }}
      >
        <Text style={{ color: colors.accentText, fontWeight: '700' }}>+ Add cardio session</Text>
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>Add cardio session</Text>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="E.g. 30 min elliptical, 280 kcal — or 10k run in 52 minutes"
                placeholderTextColor={colors.text2}
                multiline
                style={{ backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 12, color: colors.text, minHeight: 70, textAlignVertical: 'top', marginBottom: 10 }}
              />
              {error && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 10 }}>{error}</Text>}
              <Pressable
                onPress={handleAnalyzeAndSave}
                disabled={analyzing}
                style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center', marginBottom: 8, opacity: analyzing ? 0.6 : 1 }}
              >
                {analyzing ? <ActivityIndicator color={colors.accentText} /> : <Text style={{ color: colors.accentText, fontWeight: '700' }}>Analyze with AI</Text>}
              </Pressable>
              <Pressable onPress={() => setModalOpen(false)} style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ color: colors.text2 }}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
