/**
 * Coach Screen — AI Coach chat interface with quotas and consent.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Screen, Card, Typography, Button, Badge, EmptyState } from '@/components';
import { useTheme } from '@/theme';
import { spacing, radius, colors, fontSize, fontWeight } from '@/theme/tokens';
import { sendCoachMessage, getCoachUsage, getConversationHistory, type CoachUsage } from '@/services/coach';
import { getEntitlements, canCloudAI } from '@/services/entitlements';
import { formatRelativeTime } from '@/utils/format';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function CoachScreen() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<CoachUsage | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load initial data
  useEffect(() => {
    (async () => {
      const entitlements = await getEntitlements();
      setHasAccess(canCloudAI(entitlements));

      if (canCloudAI(entitlements)) {
        const history = await getConversationHistory(50);
        setMessages(history.map((h, i) => ({
          id: `history-${i}`,
          role: h.role as 'user' | 'assistant',
          content: h.content,
          created_at: h.created_at,
        })));

        const u = await getCoachUsage();
        if (u) setUsage(u);
      }
    })();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (trimmed.length > 500) {
      setError('Message must be 500 characters or less');
      return;
    }

    setInput('');
    setError(null);
    setLoading(true);

    // Add user message immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await sendCoachMessage(trimmed);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setUsage(result.usage);
    } catch (err: any) {
      const errorMsg = err.message ?? 'Failed to get response';
      setError(errorMsg);

      // Add error as assistant message
      const errMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `?? ${errorMsg}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  if (!hasAccess) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl }}>
          <Typography variant="h2" align="center" style={{ marginBottom: spacing.md }}>
            AI Coach
          </Typography>
          <Typography variant="body" color={theme.textSecondary} align="center" style={{ marginBottom: spacing.xl }}>
            Sign in with a Pro plan to unlock AI coaching about your work patterns.
          </Typography>
          <Button title="Sign In" onPress={() => {}} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeArea={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h1">Coach</Typography>
            {usage && (
              <Badge
                label={`${usage.remaining}/${usage.limit}`}
                variant={usage.remaining === 0 ? 'error' : usage.remaining < 10 ? 'warning' : 'info'}
              />
            )}
          </View>
          <Typography variant="bodySmall" color={theme.textSecondary}>
            Ask about your work patterns
          </Typography>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <EmptyState
              title="Start a conversation"
              description="Ask your AI coach about focus patterns, productivity tips, or work insights."
            />
          )}

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                marginBottom: spacing.md,
              }}
            >
              <Card
                variant={msg.role === 'user' ? 'default' : 'flat'}
                style={{
                  backgroundColor: msg.role === 'user' ? theme.primary : theme.surfaceSecondary,
                }}
              >
                <Typography
                  variant="body"
                  color={msg.role === 'user' ? '#FFFFFF' : theme.text}
                >
                  {msg.content}
                </Typography>
              </Card>
              <Typography
                variant="caption"
                color={theme.textTertiary}
                style={{ marginTop: spacing.xs, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                {formatRelativeTime(msg.created_at)}
              </Typography>
            </View>
          ))}

          {loading && (
            <View style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}>
              <Card variant="flat">
                <Typography variant="body" color={theme.textTertiary}>
                  Thinking...
                </Typography>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View
          style={{
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.background,
          }}
        >
          {error && (
            <Typography variant="caption" color="#EF4444" style={{ marginBottom: spacing.sm }}>
              {error}
            </Typography>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: theme.surfaceSecondary,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                fontSize: fontSize.base,
                color: theme.text,
                maxHeight: 100,
              }}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach..."
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={500}
              editable={!loading}
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim() || loading}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: radius.full,
                backgroundColor: input.trim() && !loading ? theme.primary : theme.surfaceSecondary,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Typography variant="body" color={input.trim() && !loading ? '#FFFFFF' : theme.textTertiary}>
                ?
              </Typography>
            </Pressable>
          </View>
          <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
            {input.length}/500
          </Typography>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
