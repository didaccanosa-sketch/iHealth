// Pantalla de Perfil — aparte, no es un tab (ver docs/PROJECT_MAP.md).
// Cubre los campos de Identity del User Model (nombre, edad, sexo, altura,
// peso inicial): datos que el usuario ya conoce, se editan a mano aquí, no
// pasan por el Question Engine. La foto de perfil se deja fuera por ahora
// (necesita Supabase Storage — pieza aparte). Log out ya es funcional
// (2026-08-01, supabase.auth.signOut() + confirmación). Email, contraseña y
// tema siguen marcados "Coming soon": el hueco ya está reservado en la
// pantalla, pero construirlos es una pieza aparte.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../components/Card';
import { useAppTheme } from '../lib/theme-context';
import { useAuth } from '../lib/auth-context';
import { radius, spacing } from '../constants/theme';
import { loadUserModel, saveUserModel, syncIdentityToLegacyProfile } from '../features/profile/data/user-model-data';
import { setField } from '../features/profile/engine/user-model';
import type { Sex, UserModelData } from '../features/profile/engine/types';

const SEX_OPTIONS: { label: string; value: Sex }[] = [
  { label: 'Hombre', value: 'male' },
  { label: 'Mujer', value: 'female' },
  { label: 'Otro', value: 'other' },
];

const SETTINGS_ROWS = [
  { icon: 'mail' as const, label: 'Email' },
  { icon: 'lock' as const, label: 'Password' },
  { icon: 'moon' as const, label: 'Theme' },
  { icon: 'log-out' as const, label: 'Log out' },
];

function FieldRow({
  label,
  value,
  onChangeText,
  colors,
  inputStyle,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  inputStyle: object;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.text2}
        style={inputStyle}
        {...inputProps}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { session, signOut } = useAuth();
  const router = useRouter();
  const userId = session?.user.id as string;

  const handleLogout = useCallback(() => {
    const doLogout = () => {
      signOut().catch(() => {
        // si falla el signOut remoto, igualmente no hay mucho que mostrar
        // aquí — el listener de onAuthStateChange ya limpia la sesión local
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión?')) doLogout();
    } else {
      Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: doLogout },
      ]);
    }
  }, [signOut]);

  const [model, setModel] = useState<UserModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [startingWeightKg, setStartingWeightKg] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadUserModel(userId)
      .then((m) => {
        if (cancelled) return;
        setModel(m);
        setFirstName(m.identity.firstName.value ?? '');
        setLastName(m.identity.lastName.value ?? '');
        setAge(m.identity.age.value != null ? String(m.identity.age.value) : '');
        setHeightCm(m.identity.heightCm.value != null ? String(m.identity.heightCm.value) : '');
        setStartingWeightKg(m.identity.startingWeightKg.value != null ? String(m.identity.startingWeightKg.value) : '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const chooseSex = useCallback(
    (value: Sex) => {
      if (!model) return;
      setModel(setField(model, 'identity', 'sex', value));
    },
    [model]
  );

  const save = useCallback(async () => {
    if (!model) return;
    setSaving(true);
    setSaved(false);
    let next = model;
    const ageNum = age.trim() ? Number(age) : null;
    const heightNum = heightCm.trim() ? Number(heightCm) : null;
    const weightNum = startingWeightKg.trim() ? Number(startingWeightKg) : null;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst) next = setField(next, 'identity', 'firstName', trimmedFirst);
    if (trimmedLast) next = setField(next, 'identity', 'lastName', trimmedLast);
    if (ageNum != null && !Number.isNaN(ageNum)) next = setField(next, 'identity', 'age', ageNum);
    if (heightNum != null && !Number.isNaN(heightNum)) next = setField(next, 'identity', 'heightCm', heightNum);
    if (weightNum != null && !Number.isNaN(weightNum)) next = setField(next, 'identity', 'startingWeightKg', weightNum);

    const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');

    try {
      await saveUserModel(userId, next);
      await syncIdentityToLegacyProfile(userId, {
        fullName: fullName || null,
        heightCm: heightNum,
        startingWeightKg: weightNum,
        daysPerWeek: next.training.daysPerWeek.value,
      });
      setModel(next);
      setSaved(true);
    } catch {
      // se queda como estaba, el usuario puede reintentar con Save
    }
    setSaving(false);
  }, [model, firstName, lastName, age, heightCm, startingWeightKg, userId]);

  if (loading || !model) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const inputStyle = {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
  };

  const displayName = [model.identity.firstName.value, model.identity.lastName.value].filter(Boolean).join(' ');
  const initial = (displayName || session?.user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={12} onPress={() => {}}>
            <Feather name="settings" size={20} color={colors.text2} />
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.sm,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 30 }}>{initial}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{displayName || 'Your name'}</Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>{session?.user.email}</Text>
        </View>

        <Card>
          <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md }}>
            ABOUT YOU
          </Text>

          <FieldRow label="First name" value={firstName} onChangeText={setFirstName} colors={colors} inputStyle={inputStyle} placeholder="e.g. Didac" />
          <FieldRow label="Last name" value={lastName} onChangeText={setLastName} colors={colors} inputStyle={inputStyle} placeholder="e.g. Cañosa" />
          <FieldRow label="Age" value={age} onChangeText={setAge} colors={colors} inputStyle={inputStyle} placeholder="e.g. 28" keyboardType="number-pad" />

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Sex</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {SEX_OPTIONS.map((opt) => {
              const active = model.identity.sex.value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => chooseSex(opt.value)}
                  style={{
                    flex: 1,
                    backgroundColor: active ? colors.accent : colors.surface2,
                    borderRadius: radius.md,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '600', fontSize: 13 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FieldRow label="Height (cm)" value={heightCm} onChangeText={setHeightCm} colors={colors} inputStyle={inputStyle} placeholder="e.g. 178" keyboardType="number-pad" />
          <View style={{ marginBottom: 0 }}>
            <FieldRow
              label="Starting weight (kg)"
              value={startingWeightKg}
              onChangeText={setStartingWeightKg}
              colors={colors}
              inputStyle={inputStyle}
              placeholder="e.g. 82"
              keyboardType="decimal-pad"
            />
          </View>
        </Card>

        <Pressable
          onPress={save}
          disabled={saving}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.md,
            padding: 14,
            alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Save</Text>
          )}
        </Pressable>
        {saved && (
          <Text style={{ color: colors.success, fontSize: 13, textAlign: 'center', marginTop: spacing.sm }}>Saved</Text>
        )}

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
            SETTINGS
          </Text>
          {SETTINGS_ROWS.map((row, i) => {
            const isLogout = row.label === 'Log out';
            const Row = isLogout ? Pressable : View;
            return (
              <Row
                key={row.label}
                onPress={isLogout ? handleLogout : undefined}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  opacity: isLogout ? 1 : 0.45,
                }}
              >
                <Feather name={row.icon} size={16} color={isLogout ? colors.danger : colors.text2} style={{ marginRight: spacing.sm }} />
                <Text style={{ color: isLogout ? colors.danger : colors.text, fontSize: 14, flex: 1 }}>{row.label}</Text>
                {!isLogout && <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>COMING SOON</Text>}
              </Row>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
