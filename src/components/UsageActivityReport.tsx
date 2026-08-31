import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadUsageForWindow } from '@/services/deviceActivity';
import { useTheme } from '@/theme';
import { colors, radius, spacing } from '@/theme/tokens';
import { formatDurationShort } from '@/utils/format';
import { Typography } from './Typography';
import type { DeviceActivityData, SessionWindow } from '../../modules/flowsight-device-activity/src';

export function UsageActivityReport({
  window,
  refreshKey = 0,
}: {
  window: SessionWindow;
  refreshKey?: number;
}) {
  const { theme } = useTheme();
  const { startMs, endMs } = window;
  const [rows, setRows] = useState<DeviceActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void loadUsageForWindow({ startMs, endMs })
      .then((result) => {
        if (mounted) setRows(result.slice(0, 12));
      })
      .catch(() => {
        if (mounted) {
          setError('Android could not read activity for this session. Review Usage Access and try again.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [endMs, refreshKey, startMs]);

  const totalSeconds = useMemo(
    () => rows.reduce((total, row) => total + row.usageSeconds, 0),
    [rows]
  );
  const longest = Math.max(...rows.map((row) => row.usageSeconds), 1);

  if (loading) {
    return (
      <View style={styles.state} accessibilityLiveRegion="polite">
        <ActivityIndicator color={theme.primary} />
        <Typography variant="caption">Reading on-device activity…</Typography>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.state} accessibilityLiveRegion="assertive">
        <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
        <Typography variant="caption" color={colors.error}>{error}</Typography>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.state} accessibilityLiveRegion="polite">
        <Ionicons name="apps-outline" size={22} color={theme.textSecondary} />
        <Typography variant="caption" style={styles.stateCopy}>
          No other app was active in this window, or Usage Access was not enabled before the session began.
        </Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Typography variant="caption">Observed app time</Typography>
        <Typography variant="subtitle">{formatDurationShort(totalSeconds)}</Typography>
      </View>
      {rows.map((row) => {
        const width = `${Math.max(4, (row.usageSeconds / longest) * 100)}%` as const;
        return (
          <View
            key={row.packageName}
            style={styles.row}
            accessible
            accessibilityLabel={`${row.appName}, ${formatDurationShort(row.usageSeconds)}`}
          >
            <View style={styles.rowHeader}>
              <Typography numberOfLines={1} style={styles.appName}>{row.appName}</Typography>
              <Typography variant="caption">{formatDurationShort(row.usageSeconds)}</Typography>
            </View>
            <View style={[styles.track, { backgroundColor: theme.surfaceTertiary }]}>
              <View style={[styles.bar, { backgroundColor: theme.primary, width }]} />
            </View>
          </View>
        );
      })}
      <Typography variant="caption" style={styles.footnote}>
        Calculated locally from Android Usage Access. Per-app rows are not saved or uploaded.
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, marginTop: spacing.sm },
  state: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  stateCopy: { textAlign: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  row: { gap: spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  appName: { flex: 1 },
  track: { height: 7, borderRadius: radius.full, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.full },
  footnote: { marginTop: spacing.xs },
});
