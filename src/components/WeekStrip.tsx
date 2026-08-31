import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Typography } from './Typography';
import { Glass } from './Glass';
import { useTheme } from '@/theme';
import type { WeekDayUsage } from '@/services/sessionInsights';
import { formatDurationShort } from '@/utils/format';
import { radius, spacing } from '@/theme/tokens';

export function WeekStrip({ days }: { days: WeekDayUsage[] }) {
  const { theme } = useTheme();
  const usedCount = days.filter((day) => day.used).length;

  return (
    <Glass style={styles.card}>
      <View style={styles.header}>
        <Typography variant="kicker" color={theme.primary}>
          This week
        </Typography>
        <Typography variant="caption">
          {usedCount === 0 ? 'No blocks yet' : `${usedCount} day${usedCount === 1 ? '' : 's'} with focus`}
        </Typography>
      </View>
      <View style={styles.row}>
        {days.map((day) => {
          const fill = day.used ? theme.primary : 'transparent';
          const border = day.isToday ? theme.primary : day.used ? theme.primary : theme.border;
          return (
            <View key={day.key} style={styles.day}>
              <Typography variant="kicker" color={day.isToday ? theme.text : theme.textTertiary}>
                {day.label}
              </Typography>
              <View
                accessibilityLabel={`${day.label}${day.used ? `, ${formatDurationShort(day.seconds)}` : ', no session'}${day.isToday ? ', today' : ''}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor: fill,
                    borderColor: border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 2,
  },
});
