import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/theme-context';
import { useAuth } from '../lib/auth-context';
import { radius, spacing } from '../constants/theme';

export function AuthScreen() {
  const { colors } = useAppTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Fill in both fields.');
      return;
    }
    setLoading(true);
    const result = mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === 'signup') {
      setInfo('Account created — check your email to confirm it, then sign in.');
      setMode('signin');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 4 }}>iHealth</Text>
        <Text style={{ fontSize: 14, color: colors.text2, marginBottom: spacing.xl }}>
          {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.text2}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            backgroundColor: colors.surface2,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 14,
            color: colors.text,
            marginBottom: spacing.md,
          }}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.text2}
          secureTextEntry
          style={{
            backgroundColor: colors.surface2,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 14,
            color: colors.text,
            marginBottom: spacing.md,
          }}
        />

        {error && <Text style={{ color: colors.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>}
        {info && <Text style={{ color: colors.success, marginBottom: spacing.md, fontSize: 13 }}>{info}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.md,
            padding: 14,
            alignItems: 'center',
            marginBottom: spacing.md,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}>
          <Text style={{ color: colors.text2, textAlign: 'center', fontSize: 13 }}>
            {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
