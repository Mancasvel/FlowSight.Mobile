/**
 * ErrorState — Error display with retry option.
 */

import React from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxxl,
      }}
    >
      <Typography variant="h3" style={{ marginBottom: spacing.sm }}>
        {title}
      </Typography>
      <Typography variant="body" color={theme.textSecondary} align="center">
        {message}
      </Typography>
      {onRetry && (
        <Button
          title="Try again"
          onPress={onRetry}
          variant="secondary"
          style={{ marginTop: spacing.xl }}
        />
      )}
    </View>
  );
}
