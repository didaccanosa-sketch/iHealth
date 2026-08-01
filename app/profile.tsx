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
import { deleteAccount } from '../lib/data/account';

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
  { icon: 'trash-2' as const, label: 'Delete account' },
];

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

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
      signOut()
        .catch(() => {
          // si falla el signOut remoto, igualmente no hay mucho que mostrar
          // aquí — el listener de onAuthStateChange ya limpia la sesión local
        })
        .finally(() => {
          // Resetea la URL a la raíz — si no, en web se queda en /profile y
          // al volver a iniciar sesión (o crear cuenta) Expo Router aterriza
          // ahí directo, sin nada debajo en el historial (router.back() no
          // tiene a dónde ir).
          router.replace('/');
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
  }, [signOut, router]);

  const [deletingAccount, setDeletingAccount] = useState(false);

  // Borra la cuenta y absolutamente todo lo asociado (ver
  // supabase/functions/delete-account) — irreversible, por eso el aviso es
  // más explícito que el de cerrar sesión.
  const handleDeleteAccount = useCallback(() => {
    const doDelete = async () => {
      setDeletingAccount(true);
      try {
        await deleteAccount();
        router.replace('/');
      } catch {
        setDeletingAccount(false);
        if (Platform.OS === 'web') {
          window.alert('No se ha podido borrar la cuenta — inténtalo de nuevo en un momento.');
        } else {
          Alert.alert('Error', 'No se ha podido borrar la cuenta — inténtalo de nuevo en un momento.');
        }
      }
    };
    const message = 'Esto borra tu cuenta y todos tus datos (objetivo, peso, comidas, entrenos...) para siempre. No se puede deshacer.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) doDelete();
    } else {
      Alert.alert('Borrar cuenta', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar cuenta', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [router]);

  const [model, setModel] = useState<UserModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

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
        resetFieldsFromModel(m);
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

  const resetFieldsFromModel = useCallback((m: UserModelData) => {
    setFirstName(m.identity.firstName.value ?? '');
    setLastName(m.identity.lastName.value ?? '');
    setAge(m.identity.age.value != null ? String(m.identity.age.value) : '');
    setHeightCm(m.identity.heightCm.value != null ? String(m.identity.heightCm.value) : '');
    setStartingWeightKg(m.identity.startingWeightKg.value != null ? String(m.identity.startingWeightKg.value) : '');
  }, []);

  const cancelEdit = useCallback(() => {
    if (model) resetFieldsFromModel(model);
    setSaved(false);
    setEditing(false);
  }, [model, resetFieldsFromModel]);

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
      setEditing(false);
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
          <View style={{ position: 'relative', marginBottom: spacing.sm }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 30 }}>{initial}</Text>
            </View>
            {!editing && (
              <Pressable
                onPress={() => setEditing(true)}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.bg,
                }}
              >
                <Feather name="edit-2" size={13} color={colors.accentText} />
              </Pressable>
            )}
          </View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{displayName || 'Your name'}</Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2 }}>{session?.user.email}</Text>
        </View>

        <Card>
          <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md }}>
            ABOUT YOU
          </Text>

          {editing ? (
            <>
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
            </>
          ) : (
            <>
              <InfoRow label="Name" value={displayName || '—'} colors={colors} />
              <InfoRow label="Age" value={model.identity.age.value != null ? String(model.identity.age.value) : '—'} colors={colors} />
              <InfoRow
                label="Sex"
                value={SEX_OPTIONS.find((o) => o.value === model.identity.sex.value)?.label ?? '—'}
                colors={colors}
              />
              <InfoRow
                label="Height"
                value={model.identity.heightCm.value != null ? `${model.identity.heightCm.value} cm` : '—'}
                colors={colors}
              />
              <InfoRow
                label="Starting weight"
                value={model.identity.startingWeightKg.value != null ? `${model.identity.startingWeightKg.value} kg` : '—'}
                colors={colors}
              />
            </>
          )}
        </Card>

        {editing && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={cancelEdit}
              disabled={saving}
              style={{
                flex: 1,
                backgroundColor: colors.surface2,
                borderRadius: radius.md,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving}
              style={{
                flex: 2,
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
          </View>
        )}
        {saved && !editing && (
          <Text style={{ color: colors.success, fontSize: 13, textAlign: 'center', marginTop: spacing.sm }}>Saved</Text>
        )}

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
            SETTINGS
          </Text>
          {SETTINGS_ROWS.map((row, i) => {
            const isLogout = row.label === 'Log out';
            const isDelete = row.label === 'Delete account';
            const isActive = isLogout || isDelete;
            const Row = isActive ? Pressable : View;
            const onPress = isLogout ? handleLogout : isDelete ? handleDeleteAccount : undefined;
            return (
              <Row
                key={row.label}
                onPress={onPress}
                disabled={isDelete && deletingAccount}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  opacity: isActive ? (isDelete && deletingAccount ? 0.5 : 1) : 0.45,
                }}
              >
                <Feather name={row.icon} size={16} color={isActive ? colors.danger : colors.text2} style={{ marginRight: spacing.sm }} />
                <Text style={{ color: isActive ? colors.danger : colors.text, fontSize: 14, flex: 1 }}>
                  {isDelete && deletingAccount ? 'Deleting…' : row.label}
                </Text>
                {!isActive && <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>COMING SOON</Text>}
              </Row>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
