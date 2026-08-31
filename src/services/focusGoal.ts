import { getPreference, setPreference } from '@/storage';

const GOAL_KEY = 'focus_goal_minutes';

export const DEFAULT_FOCUS_GOAL_MINUTES = 25;
export const MIN_FOCUS_GOAL_MINUTES = 5;
export const MAX_FOCUS_GOAL_MINUTES = 8 * 60;

export function formatFocusGoal(minutes: number): string {
  const safe = clampFocusGoalMinutes(minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function clampFocusGoalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_FOCUS_GOAL_MINUTES;
  const rounded = Math.round(minutes);
  return Math.min(MAX_FOCUS_GOAL_MINUTES, Math.max(MIN_FOCUS_GOAL_MINUTES, rounded));
}

export async function getFocusGoalMinutes(): Promise<number> {
  try {
    const raw = await getPreference(GOAL_KEY);
    if (raw == null || raw === '') return DEFAULT_FOCUS_GOAL_MINUTES;
    return clampFocusGoalMinutes(Number(raw));
  } catch {
    return DEFAULT_FOCUS_GOAL_MINUTES;
  }
}

export async function setFocusGoalMinutes(minutes: number): Promise<number> {
  const next = clampFocusGoalMinutes(minutes);
  await setPreference(GOAL_KEY, String(next));
  return next;
}
