/**
 * useAuth — Hook for authentication state.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithEmail,
  signUpWithEmail,
  signOut,
} from '@/services';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setUser((session as any)?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    return signInWithEmail(email, password);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    return signUpWithEmail(email, password);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };
}
