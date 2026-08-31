/**
 * Native implementation. Do not import this from screens or timer.
 * notifications.ts loads it only after ExpoPushTokenManager exists.
 */

import * as Notifications from 'expo-notifications';
import { getPreference, setPreference } from '@/storage';
import { getFocusGoalMinutes } from './focusGoal';

const PREFERENCE_KEY = 'notifications_enabled';

const IDS = {
  morning: 'flowsight.daily.morning',
  afternoon: 'flowsight.daily.afternoon',
  evening: 'flowsight.daily.evening',
  goal: 'flowsight.session.goal',
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function areEnabled(): Promise<boolean> {
  return (await getPreference(PREFERENCE_KEY)) === 'true';
}

export async function setFocusNotificationsEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    await disableFocusNotifications();
    return false;
  }

  const granted = await requestFocusNotificationPermission();
  if (!granted) {
    await setPreference(PREFERENCE_KEY, 'false');
    return false;
  }

  await setPreference(PREFERENCE_KEY, 'true');
  await scheduleDailyReminders();
  return true;
}

export async function hydrateFocusNotifications(): Promise<void> {
  if (!(await areEnabled())) return;
  const granted = await requestFocusNotificationPermission();
  if (!granted) {
    await setPreference(PREFERENCE_KEY, 'false');
    return;
  }
  await scheduleDailyReminders();
}

export async function disableFocusNotifications(): Promise<void> {
  await setPreference(PREFERENCE_KEY, 'false');
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleFocusGoalNotification(elapsedSeconds: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDS.goal);
  if (!(await areEnabled())) return;

  const goalSeconds = (await getFocusGoalMinutes()) * 60;
  const remaining = goalSeconds - elapsedSeconds;
  if (remaining < 15) return;

  const minutes = Math.round(goalSeconds / 60);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.goal,
    content: {
      title: `${minutes} minutes in`,
      body: 'You are in flow. Stay with this block, or stop when the work is done.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.ceil(remaining),
      repeats: false,
    },
  });
}

export async function cancelFocusGoalNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDS.goal);
}

export async function markFocusDayCompleted(): Promise<void> {
  await cancelFocusGoalNotification();
  if (!(await areEnabled())) return;
  await Notifications.cancelScheduledNotificationAsync(IDS.afternoon);
  await scheduleAfternoonNudge(true);
}

async function requestFocusNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted
    ? existing.status
    : (await Notifications.requestPermissionsAsync()).status;
  return status === 'granted';
}

async function scheduleDailyReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDS.morning);
  await Notifications.cancelScheduledNotificationAsync(IDS.evening);
  await Notifications.cancelScheduledNotificationAsync(IDS.afternoon);

  await Notifications.scheduleNotificationAsync({
    identifier: IDS.morning,
    content: {
      title: "What's next?",
      body: 'Start a focus block. Twenty-five quiet minutes is enough.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: IDS.evening,
    content: {
      title: 'Protect tomorrow',
      body: 'A short block today makes tomorrow easier. Open FlowSight when you are ready.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });

  await scheduleAfternoonNudge(false);
}

async function scheduleAfternoonNudge(afterCompletedBlock: boolean): Promise<void> {
  const now = new Date();
  const target = new Date();
  target.setHours(14, 30, 0, 0);
  if (afterCompletedBlock || now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: IDS.afternoon,
    content: {
      title: 'Still time for one block',
      body: 'A quiet hour this afternoon protects the rest of the day.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}
