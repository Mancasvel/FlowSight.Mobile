/**
 * Onboarding Screen — Multi-step onboarding with draft persistence.
 *
 * Steps: Welcome ? Name ? Roles ? Activities ? Objectives ? Daily Goal
 * Each step saves a draft. Optional steps can be skipped.
 * No permissions requested during onboarding.
 */

import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Typography, Button, Input } from '@/components';
import { useTheme } from '@/theme';
import { spacing, radius, colors } from '@/theme/tokens';
import { setPreference } from '@/storage';

const ROLES = [
  'Software Engineer', 'Designer', 'Product Manager', 'Data Scientist',
  'DevOps', 'QA Engineer', 'Researcher', 'Writer', 'Manager', 'Other',
];

const ACTIVITIES = [
  'Coding', 'Writing', 'Meetings', 'Research', 'Design',
  'Planning', 'Debugging', 'Testing', 'Documentation', 'Communication',
];

const OBJECTIVES = [
  'More deep focus time', 'Less context switching', 'Better work-life balance',
  'Understand my patterns', 'Improve productivity', 'Track team progress',
];

const STEPS = [
  { key: 'welcome', title: 'Welcome to FlowSight', subtitle: 'Privacy-first work intelligence', required: false },
  { key: 'name', title: 'What should we call you?', subtitle: 'Your name', required: true },
  { key: 'roles', title: 'What describes your work?', subtitle: 'Select all that apply', required: false },
  { key: 'activities', title: 'What do you spend time on?', subtitle: 'Select your main activities', required: false },
  { key: 'objectives', title: 'What do you want to improve?', subtitle: 'Select your goals', required: false },
  { key: 'daily_goal', title: 'Set your daily focus goal', subtitle: 'Minutes of focused work per day', required: false },
] as const;

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [selectedObjectives, setSelectedObjectives] = useState<Set<string>>(new Set());
  const [dailyGoal, setDailyGoal] = useState('480');

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isWelcome = step.key === 'welcome';

  const toggleItem = useCallback((set: Set<string>, setter: (s: Set<string>) => void, item: string) => {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setter(next);
  }, []);

  const canProceed = useCallback(() => {
    if (step.key === 'name') return name.trim().length > 0;
    return true;
  }, [step.key, name]);

  const handleNext = useCallback(async () => {
    // Save draft for current step
    if (step.key === 'name') await setPreference('onboarding_name', name);
    if (step.key === 'roles') await setPreference('onboarding_roles', JSON.stringify([...selectedRoles]));
    if (step.key === 'activities') await setPreference('onboarding_activities', JSON.stringify([...selectedActivities]));
    if (step.key === 'objectives') await setPreference('onboarding_objectives', JSON.stringify([...selectedObjectives]));
    if (step.key === 'daily_goal') await setPreference('onboarding_daily_goal', dailyGoal);

    if (isLast) {
      // Complete onboarding
      await setPreference('onboarding_completed', 'true');
      await setPreference('display_name', name);
      await setPreference('daily_goal_minutes', dailyGoal || '480');
      await setPreference('roles', JSON.stringify([...selectedRoles]));
      await setPreference('activities', JSON.stringify([...selectedActivities]));
      await setPreference('objectives', JSON.stringify([...selectedObjectives]));
      router.replace('/(tabs)');
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [step.key, name, selectedRoles, selectedActivities, selectedObjectives, dailyGoal, isLast]);

  const handleSkip = useCallback(() => {
    if (isLast) {
      router.replace('/(tabs)');
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLast]);

  const renderStepContent = () => {
    switch (step.key) {
      case 'welcome':
        return (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxxl }}>
            <Typography variant="display" color={theme.primary} style={{ marginBottom: spacing.lg }}>
              ??
            </Typography>
            <Typography variant="h2" align="center" style={{ marginBottom: spacing.md }}>
              Understand your work patterns
            </Typography>
            <Typography variant="body" color={theme.textSecondary} align="center">
              FlowSight tracks your focus time, identifies patterns, and helps you work better — all while keeping your data private.
            </Typography>
          </View>
        );

      case 'name':
        return (
          <View style={{ paddingVertical: spacing.xxl }}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoFocus
              autoCapitalize="words"
            />
          </View>
        );

      case 'roles':
      case 'activities':
      case 'objectives':
        const items = step.key === 'roles' ? ROLES : step.key === 'activities' ? ACTIVITIES : OBJECTIVES;
        const selected = step.key === 'roles' ? selectedRoles : step.key === 'activities' ? selectedActivities : selectedObjectives;
        const setter = step.key === 'roles' ? setSelectedRoles : step.key === 'activities' ? setSelectedActivities : setSelectedObjectives;

        return (
          <View style={{ paddingVertical: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {items.map((item) => (
              <Pressable
                key={item}
                onPress={() => toggleItem(selected, setter, item)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.full,
                  backgroundColor: selected.has(item) ? theme.primary : theme.surfaceSecondary,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Typography
                  variant="body"
                  color={selected.has(item) ? '#FFFFFF' : theme.text}
                >
                  {item}
                </Typography>
              </Pressable>
            ))}
          </View>
        );

      case 'daily_goal':
        return (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <Input
              value={dailyGoal}
              onChangeText={setDailyGoal}
              placeholder="480"
              keyboardType="numeric"
              style={{ textAlign: 'center', fontSize: 40, fontWeight: '700' }}
            />
            <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.md }}>
              minutes per day
            </Typography>
            <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
              {['240', '360', '480', '600'].map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setDailyGoal(preset)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                    backgroundColor: dailyGoal === preset ? theme.primary : theme.surfaceSecondary,
                  }}
                >
                  <Typography
                    variant="bodySmall"
                    color={dailyGoal === preset ? '#FFFFFF' : theme.text}
                  >
                    {parseInt(preset) / 60}h
                  </Typography>
                </Pressable>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Progress dots */}
        {!isWelcome && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl, gap: spacing.sm }}>
            {STEPS.slice(1).map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentStep - 1 ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i <= currentStep - 1 ? theme.primary : theme.surfaceSecondary,
                }}
              />
            ))}
          </View>
        )}

        {/* Content */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          {!isWelcome && (
            <View style={{ marginBottom: spacing.xxl }}>
              <Typography variant="h1">{step.title}</Typography>
              <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.xs }}>
                {step.subtitle}
              </Typography>
            </View>
          )}
          {renderStepContent()}
        </View>

        {/* Actions */}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Button
            title={isWelcome ? 'Get Started' : isLast ? 'Start Tracking' : 'Continue'}
            onPress={handleNext}
            disabled={!canProceed()}
            size="lg"
          />
          {!step.required && !isWelcome && (
            <Button title="Skip" onPress={handleSkip} variant="ghost" />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
