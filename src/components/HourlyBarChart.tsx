import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Typography } from './Typography';
import { useTheme, categoryColor } from '@/theme';
import { formatDurationShort } from '@/utils/format';
import { visibleHourBuckets, type HourBucket } from '@/services/sessionInsights';
import { radius } from '@/theme/tokens';

const CHART_HEIGHT = 148;
const DAY_AXIS_LABELS = new Set([0, 6, 12, 18]);

function hourCaption(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

export function HourlyBarChart({ buckets }: { buckets: HourBucket[] }) {
  const { theme } = useTheme();
  const nowHour = new Date().getHours();
  const visible = useMemo(() => visibleHourBuckets(buckets, nowHour), [buckets, nowHour]);
  const peak = useMemo(() => {
    const richest = [...visible].sort((a, b) => b.seconds - a.seconds)[0];
    return richest && richest.seconds > 0 ? richest.hour : visible[Math.floor(visible.length / 2)]?.hour ?? nowHour;
  }, [visible, nowHour]);
  const [selected, setSelected] = useState(peak);

  useEffect(() => {
    setSelected(peak);
  }, [peak]);
  const maxSeconds = Math.max(1, ...visible.map((bucket) => bucket.seconds));
  const totalSeconds = buckets.reduce((sum, bucket) => sum + bucket.seconds, 0);
  const fullDay = visible.length === 24;
  const appRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const bucket of buckets) {
      for (const segment of bucket.segments ?? []) {
        const name =
          segment.category === 'General' || segment.category === 'Focus' ? 'Focus' : segment.category;
        totals.set(name, (totals.get(name) ?? 0) + segment.seconds);
      }
    }
    return [...totals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, seconds]) => ({ name, seconds }));
  }, [buckets]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Typography variant="kicker">Today</Typography>
          <Typography variant="metric">{formatDurationShort(totalSeconds)}</Typography>
        </View>
      </View>

      <View style={[styles.chart, { gap: fullDay ? 3 : 6 }]}>
        {visible.map((bucket) => {
          const active = bucket.hour === selected;
          const height = bucket.seconds <= 0 ? 0 : Math.max(8, (bucket.seconds / maxSeconds) * CHART_HEIGHT);
          const labeled = fullDay
            ? DAY_AXIS_LABELS.has(bucket.hour)
            : bucket.hour === visible[0]?.hour || bucket.hour === visible[visible.length - 1]?.hour;
          const segments = [...(bucket.segments ?? [])].sort((a, b) => a.seconds - b.seconds);
          return (
            <Pressable
              key={bucket.hour}
              accessibilityRole="button"
              accessibilityLabel={`${hourCaption(bucket.hour)}, ${formatDurationShort(bucket.seconds)}`}
              onPress={() => setSelected(bucket.hour)}
              style={styles.col}
            >
              <View style={styles.plot}>
                {height > 0 ? (
                  <View
                    style={[
                      styles.stack,
                      {
                        height,
                        opacity: active ? 1 : 0.88,
                        borderTopLeftRadius: radius.sm,
                        borderTopRightRadius: radius.sm,
                      },
                    ]}
                  >
                    {segments.map((segment, index) => (
                      <View
                        key={segment.category}
                        style={{
                          height: Math.max(2, (segment.seconds / bucket.seconds) * height),
                          backgroundColor: categoryColor(segment.category),
                          borderTopLeftRadius: index === segments.length - 1 ? 4 : 0,
                          borderTopRightRadius: index === segments.length - 1 ? 4 : 0,
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <Typography
                variant="kicker"
                color={active ? theme.text : theme.textTertiary}
                style={styles.tick}
              >
                {labeled ? hourCaption(bucket.hour) : ''}
              </Typography>
            </Pressable>
          );
        })}
      </View>

      {appRows.length > 0 ? (
        <View style={styles.appList}>
          {appRows.map((item) => (
            <View key={item.name} style={styles.appRow}>
              <View style={[styles.swatch, { backgroundColor: categoryColor(item.name) }]} />
              <Typography style={styles.appName} numberOfLines={1}>
                {item.name}
              </Typography>
              <Typography variant="caption">{formatDurationShort(item.seconds)}</Typography>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 22,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  plot: {
    width: '100%',
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  stack: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  tick: {
    fontSize: 8,
    letterSpacing: 0,
    minHeight: 12,
  },
  appList: {
    gap: 10,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appName: {
    flex: 1,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
