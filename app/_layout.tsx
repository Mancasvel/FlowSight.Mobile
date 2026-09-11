import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, brandFonts } from '@/theme';
import { hydrateFocusNotifications } from '@/services/notifications';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

function RootLayoutNav() {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    void hydrateFocusNotifications();
    const sub = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === 'insights' || parsed.hostname === 'insights') {
        const card = typeof parsed.queryParams?.card === 'string' ? parsed.queryParams.card : undefined;
        router.push({ pathname: '/insights', params: card ? { card } : undefined });
      }
    });
    return () => sub.remove();
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutNav />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
