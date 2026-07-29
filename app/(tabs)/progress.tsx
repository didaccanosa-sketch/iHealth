import React from 'react';
import { Text, Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius } from '../../constants/theme';

export default function ProgressScreen() {
  const { colors } = useAppTheme();
  const { session, signOut } = useAuth();

  return (
    <Screen title="Progress">
      <Card>
        <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>
          Next: goal setting, weight trend, ETA prediction, body photos.
        </Text>
      </Card>
      <Card>
        <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 10 }}>
          Signed in as {session?.user.email}
        </Text>
        <Pressable
          onPress={() => signOut()}
          style={{
            backgroundColor: colors.surface2,
            borderRadius: radius.md,
            padding: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Sign out</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
