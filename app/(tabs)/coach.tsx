import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Typography } from '@/components';
import { loadRecentSessions, patternsFromSessions, type SessionPattern } from '@/services/sessionInsights';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function CoachScreen() {
  const { theme } = useTheme();
  const [patterns, setPatterns] = useState<SessionPattern[]>([]);

  useFocusEffect(
    useCallback(() => {
      void loadRecentSessions().then((sessions) => {
        setPatterns(patternsFromSessions(sessions));
      });
    }, [])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Typography variant="caption" style={{ color: theme.primary }}>ON DEVICE</Typography>
            <Typography variant="title">Tips</Typography>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: theme.glassStrong, borderColor: theme.glassBorder }]}>
            <Ionicons name="bulb-outline" size={21} color={theme.primary} />
          </View>
        </View>

        <Card style={styles.heroCard}>
          <Typography variant="subtitle">No chat and no purchases here</Typography>
          <Typography variant="caption" style={styles.body}>
            This iPhone app only shows Start?Stop Screen Time, warnings, and patterns computed on the device.
            A later FlowSight desktop build can connect your computer database and host the coach chat. Nothing is sold inside this app.
          </Typography>
        </Card>

        {patterns.map((pattern) => (
          <Card key={pattern.id} style={styles.tipCard}>
            <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
            <View style={styles.tipCopy}>
              <Typography variant="subtitle">{pattern.title}</Typography>
              <Typography variant="caption">{pattern.body}</Typography>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: { gap: spacing.sm, borderRadius: radius.glass },
  body: { lineHeight: 20 },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tipCopy: { flex: 1, gap: 2 },
});
