/**
 * US-036 — Duration Parser for Reminders
 * 
 * Parse French duration expressions for reminder creation.
 * Supports: "dans X minutes/heures", "à Xh", "à X:Y", "dans une demi-heure"
 */

export interface ParsedReminder {
  title: string;
  dueDate: Date;
}

/**
 * Parse a reminder request from text.
 * Returns null if no valid time expression found.
 */
export function parseReminderRequest(text: string): ParsedReminder | null {
  const now = new Date();
  const lowered = text.toLowerCase();
  
  let dueDate: Date | null = null;
  let title = 'Rappel Diva';
  
  // Pattern 1: "dans X minutes/heures/secondes"
  const durationMatch = lowered.match(
    /dans\s+(\d+)\s*(minute|min|heure|h|seconde|sec|s)s?/i
  );
  
  if (durationMatch) {
    const amount = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    
    let ms = 0;
    if (unit.startsWith('min') || unit === 'm') {
      ms = amount * 60 * 1000;
    } else if (unit.startsWith('heure') || unit === 'h') {
      ms = amount * 60 * 60 * 1000;
    } else if (unit.startsWith('sec') || unit === 's') {
      ms = amount * 1000;
    }
    
    if (ms > 0) {
      dueDate = new Date(now.getTime() + ms);
    }
  }
  
  // Pattern 2: "dans une demi-heure" / "dans une heure et demie"
  if (!dueDate) {
    if (/dans\s+(une?\s+)?demi[- ]?heure/i.test(lowered)) {
      dueDate = new Date(now.getTime() + 30 * 60 * 1000);
    } else if (/dans\s+une?\s+heure\s+et\s+demie?/i.test(lowered)) {
      dueDate = new Date(now.getTime() + 90 * 60 * 1000);
    }
  }
  
  // Pattern 3: "à Xh" or "à X:Y" or "à Xh30"
  if (!dueDate) {
    const timeMatch = lowered.match(/à\s+(\d{1,2})[h:](\d{2})?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2] ?? '0', 10);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        dueDate = new Date(now);
        dueDate.setHours(hours, minutes, 0, 0);
        
        // If the time is in the past, set for tomorrow
        if (dueDate <= now) {
          dueDate.setDate(dueDate.getDate() + 1);
        }
      }
    }
  }
  
  // Pattern 4: "demain à Xh"
  if (!dueDate) {
    const tomorrowMatch = lowered.match(/demain\s+(?:à\s+)?(\d{1,2})[h:]?(\d{2})?/);
    if (tomorrowMatch) {
      const hours = parseInt(tomorrowMatch[1], 10);
      const minutes = parseInt(tomorrowMatch[2] ?? '0', 10);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(hours, minutes, 0, 0);
      }
    }
  }
  
  if (!dueDate) {
    return null;
  }
  
  // Extract title from various patterns:
  // - "rappelle-moi de X dans Y" → X
  // - "rappelle-moi X à Yh" → X
  // - "rappelle-moi dans Y de X" → X
  
  // Pattern: "de faire X" before time expression
  const titlePatterns = [
    // "rappelle-moi de X dans/à"
    /rappelle[- ]?(?:moi\s+)?de\s+(.+?)\s+(?:dans|à)\s+/i,
    // "rappelle-moi X dans/à" (without "de")
    /rappelle[- ]?(?:moi\s+)?(?:que\s+)?(.+?)\s+(?:dans|à)\s+\d/i,
    // "dans X de Y" (less common)
    /(?:dans|à)\s+.+?\s+(?:de\s+)?(.+?)$/i,
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Filter out time-related words that might have been captured
      if (extracted && !/(minute|heure|seconde|demain|aujourd)/i.test(extracted)) {
        title = extracted;
        break;
      }
    }
  }
  
  // Clean up title: remove trailing punctuation, capitalize first letter
  title = title.replace(/[.!?,;:]+$/, '').trim();
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return { title, dueDate };
}

/**
 * Format a date for human-readable display in French.
 */
export function formatReminderTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 60) {
    return `dans ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
  
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) {
    const mins = diffMins % 60;
    if (mins > 0) {
      return `dans ${diffHours}h${mins.toString().padStart(2, '0')}`;
    }
    return `dans ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  }
  
  // Format as "demain à Xh" or date
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === tomorrow.toDateString()) {
    return `demain à ${date.getHours()}h${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Check if text looks like a reminder request.
 */
export function isReminderRequest(text: string): boolean {
  const lowered = text.toLowerCase();
  return /rappelle[- ]?(moi|nous|toi)/i.test(lowered) && 
         /(dans|à\s+\d)/i.test(lowered);
}
