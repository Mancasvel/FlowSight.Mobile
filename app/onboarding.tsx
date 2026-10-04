import React, { useEffect, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Button, Typography, BrandMark, Card } from '@/components';
import { updatePrivacyConsent } from '@/privacy/privacyService';
import { hasUsageAccess, openUsageAccessSettings } from '@/services/deviceActivity';
import { setPreference } from '@/storage';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

const STEPS = [
  {
    icon: 'play-circle-outline' as const,
    title: 'Welcome to FlowSight',
    body: 'Play starts a block. Stop ends it. Android app activity is measured only inside that window.',
  },
  {
    icon: 'lock-closed-outline' as const,
    title: 'Your data stays on this device',
    body: 'App names never leave this Android device. Timer totals stay in local SQLite unless you later opt in to sync.',
  },
  {
    icon: 'apps-outline' as const,
    title: 'Enable Usage Access',
    body: 'Android can report app names and foreground duration. FlowSight never reads screen contents, typing, messages, or browsing history.',
  },
  {
    icon: 'pulse-outline' as const,
    title: 'Live timeline',
    body: 'While you work, the hour line updates locally. Recording stays off until Usage Access is enabled.',
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
  const [usageAccess, setUsageAccess] = useState(false);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    void hasUsageAccess().then(setUsageAccess);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void hasUsageAccess().then(setUsageAccess);
    });
    return () => subscription.remove();
  }, []);

  const continueOnboarding = async () => {
    if (step === 2 && !usageAccess) {
      await updatePrivacyConsent({ tracking: true });
      await openUsageAccessSettings();
      return;
    }
    setStep((value) => value + 1);
  };

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
          {step === 2 ? (
            <View style={[styles.permissionState, { backgroundColor: theme.surfaceSecondary, borderColor: theme.glassBorder }]}>
              <Ionicons
                name={usageAccess ? 'checkmark-circle' : 'information-circle-outline'}
                size={20}
                color={theme.primary}
              />
              <Typography variant="caption" style={styles.permissionCopy}>
                {usageAccess
                  ? 'Usage Access is enabled. FlowSight can build the local app timeline.'
                  : 'You can grant this later in Settings. Recording stays off until then.'}
              </Typography>
            </View>
          ) : null}
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
          <Button
            label={step === 2 && !usageAccess ? 'Open Usage Access' : 'Continue'}
            onPress={() => void continueOnboarding()}
          />
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
  permissionState: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
  },
  permissionCopy: { flex: 1 },
  actions: { gap: spacing.sm, paddingBottom: spacing.md },
});
