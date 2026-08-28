import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { Card } from './Card';
import { Glass } from './Glass';
import { Typography } from './Typography';

export function StatusChip({
  label,
  tone = 'idle',
}: {
  label: string;
  tone?: 'live' | 'paused' | 'idle' | 'ok';
}) {
  const { theme } = useTheme();
  const color =
    tone === 'live' ? '#10B981' : tone === 'paused' ? '#F59E0B' : tone === 'ok' ? theme.primary : theme.textTertiary;

  return (
    <View style={[styles.chip, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Typography variant="kicker" color={color} style={styles.chipLabel}>
        {label}
      </Typography>
    </View>
  );
}

export function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card style={styles.metric}>
      <Typography variant="kicker">{label}</Typography>
      <Typography variant="metric">{value}</Typography>
      {hint ? <Typography variant="caption">{hint}</Typography> : null}
    </Card>
  );
}

export function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      {kicker ? (
        <Typography variant="kicker" color={theme.primary}>
          {kicker}
        </Typography>
      ) : null}
      <Typography variant="subtitle">{title}</Typography>
      {subtitle ? <Typography variant="caption">{subtitle}</Typography> : null}
    </View>
  );
}

export function Notice({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const color = tone === 'error' ? '#EF4444' : tone === 'warn' ? '#F59E0B' : '#00B8A9';

  return (
    <Glass radiusSize="lg" style={styles.notice}>
      <View style={styles.noticeInner}>
        <View style={[styles.noticeIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Typography variant="caption" style={styles.noticeCopy}>
          {children}
        </Typography>
      </View>
    </Glass>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  const { theme } = useTheme();
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceTertiary }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.primary }]} />
    </View>
  );
}

export function ListRow({
  icon,
  label,
  color,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.listRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderLight }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Typography style={styles.menuLabel}>{label}</Typography>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </Pressable>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: theme.surfaceSecondary, borderColor: theme.glassBorder }]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            onPress={() => onChange(option.id)}
            style={[styles.segmentItem, active && { backgroundColor: theme.glassStrong }]}
          >
            <Typography variant="caption" color={active ? theme.text : theme.textSecondary}>
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  caption: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Typography variant="subtitle">{label}</Typography>
        <Typography variant="caption">{caption}</Typography>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'center',
  },
  chipLabel: {
    letterSpacing: 1.1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  metric: {
    flex: 1,
    gap: 6,
  },
  section: {
    gap: 4,
  },
  notice: {
    padding: spacing.md,
  },
  noticeInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCopy: {
    flex: 1,
    lineHeight: 18,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  listRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
});
