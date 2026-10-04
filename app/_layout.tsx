import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, brandFonts } from '@/theme';
import { hydrateFocusNotifications } from '@/services/notifications';
import { AppState } from 'react-native';
import { startPeriodicSync, stopPeriodicSync, syncNow } from '@/services/sync';
import { onAuthStateChange } from '@/services/auth';
import { getCurrentSession, recoverTimer, suspendTimerForAccountSwitch, validateRecordingPermission } from '@/services/timer';

function RootLayoutNav() {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    void hydrateFocusNotifications();
    startPeriodicSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { startPeriodicSync(); void syncNow(); void validateRecordingPermission().catch(() => undefined); }
      else stopPeriodicSync();
    });
    const { data: { subscription: authSubscription } } = onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? null;
      const timerSession = getCurrentSession();
      if (timerSession && timerSession.userId !== nextOwner) {
        // Supabase auth callbacks must return before calling auth-dependent work.
        setTimeout(() => { void suspendTimerForAccountSwitch().then(recoverTimer).catch(() => undefined); }, 0);
      }
    });
    return () => { subscription.remove(); authSubscription.unsubscribe(); stopPeriodicSync(); };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(brandFonts);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
