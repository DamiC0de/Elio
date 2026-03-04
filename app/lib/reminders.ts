/**
 * US-036 — Native iOS Reminders Service
 * 
 * Create native iOS reminders using EventKit (via expo-calendar).
 * Reminders appear in the native Reminders app and trigger push notifications.
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

const DIVA_LIST_NAME = 'Diva';
const DIVA_LIST_COLOR = '#8B5CF6'; // Purple brand color

/**
 * Request reminders permission from the user.
 * On iOS, this prompts for EventKit Reminders access.
 * On Android, reminders use calendars (same permission).
 */
export async function requestRemindersPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const { status } = await Calendar.requestRemindersPermissionsAsync();
    return status === 'granted';
  } else {
    // Android: reminders are actually calendar events
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  }
}

/**
 * Check if reminders permission is granted.
 */
export async function checkRemindersPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const { status } = await Calendar.getRemindersPermissionsAsync();
    return status === 'granted';
  } else {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  }
}

/**
 * Get or create the Diva reminders list.
 * Returns the calendar/list ID.
 */
async function getOrCreateDivaList(): Promise<string> {
  if (Platform.OS === 'ios') {
    // iOS: Use Reminders
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
    const divaList = calendars.find(c => c.title === DIVA_LIST_NAME);
    
    if (divaList) {
      return divaList.id;
    }
    
    // Create new list - find a suitable source
    // Prefer iCloud source, fallback to local
    const iCloudSource = calendars.find(c => 
      c.source?.type === 'caldav' || c.source?.name?.toLowerCase().includes('icloud')
    )?.source;
    
    const localSource = calendars.find(c => 
      c.source?.type === 'local'
    )?.source;
    
    const defaultSource = iCloudSource ?? localSource ?? calendars[0]?.source;
    
    if (!defaultSource) {
      throw new Error('Aucune source de rappels disponible');
    }
    
    const listId = await Calendar.createCalendarAsync({
      title: DIVA_LIST_NAME,
      color: DIVA_LIST_COLOR,
      entityType: Calendar.EntityTypes.REMINDER,
      sourceId: defaultSource.id,
      source: defaultSource,
      name: DIVA_LIST_NAME,
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    
    return listId;
  } else {
    // Android: Use Calendar events with reminders (alarms)
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const divaCalendar = calendars.find(c => c.title === DIVA_LIST_NAME);
    
    if (divaCalendar) {
      return divaCalendar.id;
    }
    
    // Find writable calendar
    const writableCalendar = calendars.find(c => 
      c.accessLevel === Calendar.CalendarAccessLevel.OWNER ||
      c.accessLevel === Calendar.CalendarAccessLevel.ROOT
    );
    
    if (!writableCalendar?.source) {
      throw new Error('Aucun calendrier disponible pour les rappels');
    }
    
    const calId = await Calendar.createCalendarAsync({
      title: DIVA_LIST_NAME,
      color: DIVA_LIST_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: writableCalendar.source.id,
      source: writableCalendar.source,
      name: DIVA_LIST_NAME,
      ownerAccount: writableCalendar.ownerAccount || 'local',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    
    return calId;
  }
}

export interface CreateReminderResult {
  success: boolean;
  reminderId?: string;
  error?: string;
}

/**
 * Create a native reminder.
 * 
 * @param title - Reminder title
 * @param dueDate - When the reminder should fire
 * @param notes - Optional notes/description
 */
export async function createReminder(
  title: string,
  dueDate: Date,
  notes?: string
): Promise<CreateReminderResult> {
  try {
    // Check/request permission
    let hasPermission = await checkRemindersPermission();
    
    if (!hasPermission) {
      hasPermission = await requestRemindersPermission();
      if (!hasPermission) {
        return {
          success: false,
          error: 'Permission rappels refusée. Active-la dans les réglages.',
        };
      }
    }
    
    // Get or create Diva list
    const listId = await getOrCreateDivaList();
    
    if (Platform.OS === 'ios') {
      // iOS: Create native reminder
      const reminderId = await Calendar.createReminderAsync(listId, {
        title,
        notes,
        dueDate,
        startDate: dueDate,
        alarms: [{ relativeOffset: 0 }], // Alarm at exact time
      });
      
      return {
        success: true,
        reminderId,
      };
    } else {
      // Android: Create calendar event with alarm
      const endDate = new Date(dueDate.getTime() + 30 * 60 * 1000); // 30 min duration
      
      const eventId = await Calendar.createEventAsync(listId, {
        title: `📌 ${title}`,
        notes,
        startDate: dueDate,
        endDate,
        alarms: [{ relativeOffset: 0 }],
        allDay: false,
      });
      
      return {
        success: true,
        reminderId: eventId,
      };
    }
  } catch (error) {
    console.error('[Reminders] Failed to create reminder:', error);
    return {
      success: false,
      error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create a reminder with delay in minutes (simpler API).
 * 
 * @param title - Reminder title
 * @param delayMinutes - How many minutes from now
 * @param notes - Optional notes
 */
export async function createReminderWithDelay(
  title: string,
  delayMinutes: number,
  notes?: string
): Promise<CreateReminderResult> {
  const dueDate = new Date(Date.now() + delayMinutes * 60 * 1000);
  return createReminder(title, dueDate, notes);
}

/**
 * List all reminders in the Diva list (for debugging/display).
 */
export async function listDivaReminders(): Promise<Calendar.Reminder[]> {
  if (Platform.OS !== 'ios') {
    // Android doesn't have native reminders API
    return [];
  }
  
  const hasPermission = await checkRemindersPermission();
  if (!hasPermission) return [];
  
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
    const divaList = calendars.find(c => c.title === DIVA_LIST_NAME);
    
    if (!divaList) return [];
    
    // Get reminders for the next 7 days
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const reminders = await Calendar.getRemindersAsync(
      [divaList.id],
      Calendar.ReminderStatus.INCOMPLETE,
      now,
      nextWeek
    );
    
    return reminders;
  } catch {
    return [];
  }
}
