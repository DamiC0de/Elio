/**
 * EL-032 — Notification Reader — JS API
 * Cross-platform safe: returns empty/unavailable on iOS
 */
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import type {
  CapturedNotification,
  NotificationFilter,
  NotificationReaderStatus,
} from '../types';

const LINKING_ERROR =
  `The package 'notification-reader' doesn't seem to be linked. Make sure you ran 'npx expo prebuild'.`;

const NativeModule =
  Platform.OS === 'android'
    ? NativeModules.NotificationReaderModule ??
      new Proxy({}, { get() { throw new Error(LINKING_ERROR); } })
    : null;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

/**
 * Check if the notification listener is available and has permission
 */
export async function getStatus(): Promise<NotificationReaderStatus> {
  if (Platform.OS !== 'android' || !NativeModule) {
    return {
      isAvailable: false,
      isPermissionGranted: false,
      isServiceRunning: false,
      capturedCount: 0,
    };
  }
  return NativeModule.getStatus();
}

/**
 * Open Android settings to grant Notification Access permission
 */
export async function requestPermission(): Promise<void> {
  if (Platform.OS !== 'android' || !NativeModule) return;
  return NativeModule.requestPermission();
}

/**
 * Get captured notifications with optional filters
 */
export async function getNotifications(
  filter?: NotificationFilter,
): Promise<CapturedNotification[]> {
  if (Platform.OS !== 'android' || !NativeModule) return [];
  return NativeModule.getNotifications(filter ?? {});
}

/**
 * Get notifications grouped by app
 */
export async function getNotificationsByApp(
  filter?: NotificationFilter,
): Promise<Record<string, CapturedNotification[]>> {
  const all = await getNotifications(filter);
  const grouped: Record<string, CapturedNotification[]> = {};
  for (const notif of all) {
    const key = notif.appName || notif.packageName;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(notif);
  }
  return grouped;
}

/**
 * Clear stored notifications
 */
export async function clearNotifications(
  packageName?: string,
): Promise<void> {
  if (Platform.OS !== 'android' || !NativeModule) return;
  return NativeModule.clearNotifications(packageName ?? null);
}

/**
 * Subscribe to new incoming notifications in real-time
 */
export function onNotification(
  callback: (notification: CapturedNotification) => void,
): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener(
    'onNotificationReceived',
    callback,
  );
  return () => subscription.remove();
}

export type { CapturedNotification, NotificationFilter, NotificationReaderStatus };
