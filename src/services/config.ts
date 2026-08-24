/**
 * Config — Public environment variables.
 *
 * Only EXPO_PUBLIC_ variables are safe to include in the bundle.
 * No secrets, no service-role keys, no OAuth client secrets.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[FlowSight] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Cloud features will not work.'
  );
}
