import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Button, Typography, Input, BrandMark, Card, Segmented } from '@/components';
import { useAuth } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

export default function AuthScreen() {
  const router = useRouter();
  const { theme } = useTheme();
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
      <View style={styles.top}>
        <BrandMark />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={[styles.close, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Typography variant="kicker" color={theme.primary}>
          Optional
        </Typography>
        <Typography variant="title">{mode === 'login' ? 'Sign in' : 'Create account'}</Typography>
        <Typography variant="caption">
          Sign-in never uploads Apple Screen Time. Timer totals stay on this iPhone unless you later opt in under Privacy.
        </Typography>
      </View>

      <Card style={styles.form}>
        <Segmented
          options={[
            { id: 'login', label: 'Sign in' },
            { id: 'register', label: 'Register' },
          ]}
          value={mode}
          onChange={(id) => setMode(id as 'login' | 'register')}
        />
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
        {error ? (
          <Typography variant="caption" color="#EF4444">
            {error}
          </Typography>
        ) : null}
        <Button
          label={mode === 'login' ? 'Sign in' : 'Register'}
          onPress={() => void submit()}
          loading={loading}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: 6, marginTop: spacing.xxxl },
  form: { gap: spacing.md, marginTop: spacing.xl },
});
