import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, Typography } from '@/components';
import { setPreference } from '@/storage';
import { spacing } from '@/theme/tokens';

const STEPS = [
  { title: 'Welcome to FlowSight', body: 'Start and Stop a focus block. We measure Apple Screen Time only inside that window.' },
  { title: 'Your data stays on the iPhone', body: 'App names never leave the device. Timer totals stay in local SQLite unless you later opt in to sync.' },
  { title: 'Pick apps once', body: 'Apple requires you to choose which apps to include. Without that list, Screen Time reports stay empty.' },
  { title: 'Insights', body: 'After Stop you get a per-app timeline, warnings, and simple patterns. No purchases in this app.' },
  { title: 'You are ready', body: 'Open Today and start a block. Finish it to see the session timeline.' },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = async () => {
    await setPreference('onboarding_completed', 'true');
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Typography variant="caption">
          {step + 1} / {STEPS.length}
        </Typography>
        <Typography variant="title">{current.title}</Typography>
        <Typography>{current.body}</Typography>
      </View>
      <View style={styles.actions}>
        {last ? (
          <Button label="Get started" onPress={() => void finish()} />
        ) : (
          <Button label="Continue" onPress={() => setStep((value) => value + 1)} />
        )}
        <Button label="Skip" variant="ghost" onPress={() => void finish()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  actions: { gap: spacing.sm },
});
