import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';

export default function TrainingScreen() {
  const { colors } = useAppTheme();
  return (
    <Screen title="Training">
      <Card>
        <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>
          Next: port the Workout Engine (mesocycles, sessions, RIR progression, PRs) from the web
          version.
        </Text>
      </Card>
    </Screen>
  );
}
