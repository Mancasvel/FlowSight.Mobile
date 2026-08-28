import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Button, Typography, BrandMark, Card } from '@/components';
import { setPreference } from '@/storage';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

const STEPS = [
  {
    icon: 'play-circle-outline' as const,
    title: 'Welcome to FlowSight',
    body: 'Play starts a block. Stop ends it. Screen Time is measured only inside that window.',
  },
  {
    icon: 'lock-closed-outline' as const,
    title: 'Your data stays on the iPhone',
    body: 'App names never leave the device. Timer totals stay in local SQLite unless you later opt in to sync.',
  },
  {
    icon: 'apps-outline' as const,
    title: 'Pick apps once',
    body: 'Add work apps one by one. Add Social or Entertainment as categories so those count as switching, not focus.',
  },
  {
    icon: 'pulse-outline' as const,
    title: 'Live timeline',
    body: 'While you work, the hour line updates. Focus is work apps plus idle or screen-off.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    title: 'You are ready',
    body: 'Open Today, press Start, and watch the timeline. Press Stop when you are done.',
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = async () => {
    await setPreference('onboarding_completed', 'true');
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={styles.top}>
        <BrandMark />
        <Typography variant="kicker" color={theme.primary}>
          {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </Typography>
      </View>

      <View style={styles.body}>
        <Card style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: theme.surfaceTertiary }]}>
            <Ionicons name={current.icon} size={28} color={theme.primary} />
          </View>
          <Typography variant="title">{current.title}</Typography>
          <Typography>{current.body}</Typography>
        </Card>
      </View>

      <View style={styles.dots}>
        {STEPS.map((item, index) => (
          <View
            key={item.title}
            style={[
              styles.dot,
              {
                backgroundColor: index === step ? theme.primary : theme.border,
                width: index === step ? 18 : 7,
              },
            ]}
          />
        ))}
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: { flex: 1, justifyContent: 'center' },
  card: { gap: spacing.lg, paddingVertical: spacing.xxxl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  actions: { gap: spacing.sm, paddingBottom: spacing.md },
});
