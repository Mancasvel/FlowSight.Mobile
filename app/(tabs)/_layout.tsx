import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamily } from '@/theme/tokens';

export default function TabsLayout() {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 12,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: isDark
            ? 'rgba(8, 12, 14, 0.92)'
            : 'rgba(251, 252, 251, 0.92)',
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: theme.tabBarBorder,
          borderRadius: 24,
          overflow: 'hidden',
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.bodySemibold,
          fontSize: 10,
          letterSpacing: 0.3,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'timer' : 'timer-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
