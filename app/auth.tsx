/**
 * Auth Screen — Login and registration with email/password and Google.
 */

import React, { useState, useCallback } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Typography, Button, Input } from '@/components';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/services';

export default function AuthScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = useCallback(async () => {
    if (!email || !password) return;
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }, [mode, email, password]);

  const handleGoogle = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Google sign-in failed');
    }
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
        <Typography variant="h1" style={{ marginBottom: spacing.xs }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </Typography>
        <Typography variant="body" color={theme.textSecondary} style={{ marginBottom: spacing.xxl }}>
          {mode === 'login'
            ? 'Sign in to sync your data across devices'
            : 'Create an account to unlock cloud features'}
        </Typography>

        {/* Email */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="label" color={theme.textSecondary} style={{ marginBottom: spacing.sm }}>
            Email
          </Typography>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Card>

        {/* Password */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="label" color={theme.textSecondary} style={{ marginBottom: spacing.sm }}>
            Password
          </Typography>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </Card>

        {/* Submit */}
        <Button
          title={mode === 'login' ? 'Sign In' : 'Create Account'}
          onPress={handleEmailAuth}
          loading={loading}
          style={{ marginBottom: spacing.md }}
        />

        {/* Google */}
        <Button
          title="Continue with Google"
          onPress={handleGoogle}
          variant="secondary"
          style={{ marginBottom: spacing.xl }}
        />

        {/* Toggle mode */}
        <Button
          title={
            mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'
          }
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          variant="ghost"
        />

        {/* Skip */}
        <Button
          title="Continue without account"
          onPress={() => router.back()}
          variant="ghost"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </Screen>
  );
}
