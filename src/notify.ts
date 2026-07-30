// Tägliche lokale Erinnerung (nur nativ; im Web No-op).
import { Capacitor } from '@capacitor/core';
import { notifyText, type Lang } from './i18n';

const REMINDER_ID = 1001;

export async function setupDailyReminder(enabled: boolean, lang: Lang = 'de'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Bestehende Erinnerung immer entfernen (Neuplanung / Aus).
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
    if (!enabled) return;

    const perm = await LocalNotifications.checkPermissions();
    let granted = perm.display === 'granted';
    if (!granted) {
      const req = await LocalNotifications.requestPermissions();
      granted = req.display === 'granted';
    }
    if (!granted) return;

    const texts = notifyText(lang);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: texts.title,
          body: texts.body,
          schedule: { on: { hour: 19, minute: 0 }, allowWhileIdle: true },
        },
      ],
    });
  } catch (e) {
    console.warn('Reminder übersprungen:', e);
  }
}
