/**
 * Calendar access for Diva — reads events from device calendar via expo-calendar
 */
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  calendarName?: string;
  allDay: boolean;
}

/**
 * Request calendar permission and return granted status
 */
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Get upcoming events from all calendars
 * @param daysAhead Number of days to look ahead (default 14)
 * @param daysBehind Number of days to look behind (default 1)
 */
export async function getEvents(daysAhead = 14, daysBehind = 1): Promise<CalendarEvent[]> {
  const granted = await requestCalendarPermission();
  if (!granted) return [];

  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendarIds = calendars.map(c => c.id);
    const calendarMap = new Map(calendars.map(c => [c.id, c.title]));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBehind);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    endDate.setHours(23, 59, 59, 999);

    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

    return events.map(e => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location || undefined,
      notes: e.notes || undefined,
      calendarName: calendarMap.get(e.calendarId) || undefined,
      allDay: e.allDay || false,
    })).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  } catch (error) {
    console.error('Failed to read calendar:', error);
    return [];
  }
}

export interface CreateEventInput {
  title: string;
  start_date: string;
  end_date?: string;
  location?: string;
  notes?: string;
  all_day?: boolean;
}

/**
 * Get the default calendar ID (primary calendar for the platform)
 */
async function getDefaultCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  
  // On iOS, prefer the default calendar
  if (Platform.OS === 'ios') {
    const defaultCal = calendars.find(c => c.allowsModifications && c.source.type === 'local');
    if (defaultCal) return defaultCal.id;
  }
  
  // Fallback: first modifiable calendar
  const modifiable = calendars.find(c => c.allowsModifications);
  return modifiable?.id || null;
}

/**
 * Create a new calendar event
 */
export async function createEvent(input: CreateEventInput): Promise<{ success: boolean; message: string; eventId?: string }> {
  const granted = await requestCalendarPermission();
  if (!granted) {
    return { success: false, message: "Permission calendrier refusée." };
  }

  try {
    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      return { success: false, message: "Aucun calendrier modifiable trouvé." };
    }

    const startDate = new Date(input.start_date);
    let endDate: Date;
    
    if (input.end_date) {
      endDate = new Date(input.end_date);
    } else {
      // Default: 2 hours after start
      endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    }

    const eventDetails: Calendar.Event = {
      title: input.title,
      startDate,
      endDate,
      timeZone: 'Europe/Paris',
      allDay: input.all_day || false,
    };

    if (input.location) eventDetails.location = input.location;
    if (input.notes) eventDetails.notes = input.notes;

    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);

    const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = input.all_day ? '' : ` à ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    
    return {
      success: true,
      message: `Événement "${input.title}" ajouté le ${dateStr}${timeStr}.`,
      eventId,
    };
  } catch (error) {
    console.error('Failed to create event:', error);
    return { success: false, message: `Erreur création événement: ${String(error)}` };
  }
}

/**
 * Format events for LLM context
 */
export function formatEventsForContext(events: CalendarEvent[]): string {
  if (events.length === 0) return "Aucun événement dans le calendrier.";

  const lines = events.map(e => {
    const start = new Date(e.startDate);
    const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    
    if (e.allDay) {
      let line = `${dateStr} (toute la journée) : ${e.title}`;
      if (e.location) line += ` — ${e.location}`;
      return line;
    }

    const timeStr = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(e.endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    let line = `${dateStr} ${timeStr}-${endTime} : ${e.title}`;
    if (e.location) line += ` — ${e.location}`;
    return line;
  });

  return `Événements du calendrier (${events.length}) :\n` + lines.join('\n');
}
