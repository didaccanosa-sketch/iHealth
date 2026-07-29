import React, { useEffect, useState } from 'react';
import { Text, ActivityIndicator } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';

type Status = 'checking' | 'ok' | 'error';

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<Status>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setStatus('error');
          setErrorMsg(error.message);
        } else {
          setStatus('ok');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen title="Today">
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
          Supabase connection
        </Text>
        {status === 'checking' && <ActivityIndicator color={colors.accent} />}
        {status === 'ok' && (
          <Text style={{ color: colors.success }}>
            ✓ Connected — the "profiles" table is reachable.
          </Text>
        )}
        {status === 'error' && (
          <>
            <Text style={{ color: colors.danger, marginBottom: 4 }}>
              Could not reach Supabase.
            </Text>
            <Text style={{ color: colors.text2, fontSize: 12 }}>{errorMsg}</Text>
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 8 }}>
              Checklist: did you (1) fill in .env with your Project URL and anon key, (2) run
              supabase/schema.sql in the Supabase SQL Editor, (3) restart `npx expo start` after
              editing .env?
            </Text>
          </>
        )}
      </Card>
      <Card>
        <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>
          This is the scaffold screen. The real "Today" briefing (goal, progress, checklist, AI
          summary) will replace this once the connection above shows green.
        </Text>
      </Card>
    </Screen>
  );
}
