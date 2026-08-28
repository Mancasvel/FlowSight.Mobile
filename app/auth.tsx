import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, Typography, Input } from '@/components';
import { useAuth } from '@/hooks';
import { spacing } from '@/theme/tokens';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Typography variant="title">{mode === 'login' ? 'Sign in' : 'Create account'}</Typography>
      <Typography variant="caption">
        Optional. Sign-in never uploads Apple Screen Time. Timer totals stay on this iPhone unless you later opt in under Privacy.
      </Typography>

      <View style={styles.form}>
        <Input
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Typography variant="caption">{error}</Typography> : null}
        <Button
          label={mode === 'login' ? 'Sign in' : 'Register'}
          onPress={() => void submit()}
          loading={loading}
        />
        <Button
          label={mode === 'login' ? 'Need an account?' : 'Already have an account?'}
          variant="ghost"
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.xxl },
});
