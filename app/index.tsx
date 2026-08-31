import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getPreference } from '@/storage';
import { useTheme } from '@/theme';

type InitialRoute = '/onboarding' | '/(tabs)';

export default function Index() {
  const { theme } = useTheme();
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    let active = true;

    void getPreference('onboarding_completed')
      .then((completed) => {
        if (active) setInitialRoute(completed === 'true' ? '/(tabs)' : '/onboarding');
      })
      .catch(() => {
        if (active) setInitialRoute('/onboarding');
      });

    return () => {
      active = false;
    };
  }, []);

  if (initialRoute) return <Redirect href={initialRoute} />;

  return (
    <View
      accessibilityLabel="Opening FlowSight"
      style={[styles.loading, { backgroundColor: theme.background }]}
    >
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
