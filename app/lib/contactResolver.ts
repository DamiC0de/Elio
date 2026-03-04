/**
 * US-021 — Contact Resolver
 * Resolves a contact name to a phone number using expo-contacts
 * Includes fuzzy matching for partial/nickname matches
 */

import * as Contacts from 'expo-contacts';

export interface ResolvedContact {
  id: string;
  name: string;
  phoneNumber: string;
  phoneType?: string;
}

/**
 * Normalize a phone number to international format
 * Assumes French numbers (+33) if no country code present
 */
export function normalizePhoneNumber(phone: string, defaultCountry = '+33'): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle French numbers starting with 0
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = defaultCountry + cleaned.slice(1);
  }
  
  // Ensure + prefix if not present and looks like international
  if (!cleaned.startsWith('+') && cleaned.length > 10) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Calculate a simple similarity score between two strings
 * Returns 0-1 where 1 is exact match
 */
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
  
  // Check if first names match
  const aFirst = aLower.split(/\s+/)[0];
  const bFirst = bLower.split(/\s+/)[0];
  if (aFirst === bFirst && aFirst.length > 2) return 0.7;
  
  // Check if any word matches
  const aWords = aLower.split(/\s+/);
  const bWords = bLower.split(/\s+/);
  for (const aw of aWords) {
    for (const bw of bWords) {
      if (aw === bw && aw.length > 2) return 0.5;
    }
  }
  
  return 0;
}

/**
 * Request contacts permission if not granted
 */
async function ensurePermission(): Promise<boolean> {
  const { status } = await Contacts.getPermissionsAsync();
  if (status === 'granted') return true;
  
  const { status: newStatus } = await Contacts.requestPermissionsAsync();
  return newStatus === 'granted';
}

/**
 * Resolve a contact name to a phone number
 * Uses fuzzy matching to find the best match
 * 
 * @param contactName - The name to search for (e.g., "Julie", "Maman")
 * @returns The resolved contact with phone number, or null if not found
 */
export async function resolveContactPhone(contactName: string): Promise<ResolvedContact | null> {
  const hasPermission = await ensurePermission();
  if (!hasPermission) {
    console.warn('[ContactResolver] Permission denied');
    return null;
  }
  
  // Search contacts by name
  const { data: contacts } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.Nickname,
      Contacts.Fields.PhoneNumbers,
    ],
    name: contactName, // Expo's built-in filtering
  });
  
  if (contacts.length === 0) {
    // Try broader search if exact match fails
    const { data: allContacts } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.Name,
        Contacts.Fields.FirstName,
        Contacts.Fields.LastName,
        Contacts.Fields.Nickname,
        Contacts.Fields.PhoneNumbers,
      ],
    });
    
    // Manual fuzzy search
    const scored = allContacts
      .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
      .map(c => {
        const names = [
          c.name,
          c.firstName,
          c.lastName,
          c.nickname,
          `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        ].filter(Boolean) as string[];
        
        const maxScore = Math.max(...names.map(n => similarity(n, contactName)));
        return { contact: c, score: maxScore };
      })
      .filter(x => x.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    
    if (scored.length === 0) return null;
    
    const best = scored[0].contact;
    const phone = best.phoneNumbers?.[0];
    if (!phone?.number) return null;
    
    return {
      id: best.id || '',
      name: best.name || `${best.firstName || ''} ${best.lastName || ''}`.trim(),
      phoneNumber: normalizePhoneNumber(phone.number),
      phoneType: phone.label,
    };
  }
  
  // Find best match from Expo's results
  const withPhones = contacts.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
  if (withPhones.length === 0) return null;
  
  // Score by name similarity
  const scored = withPhones
    .map(c => {
      const names = [
        c.name,
        c.firstName,
        c.lastName,
        c.nickname,
      ].filter(Boolean) as string[];
      
      const maxScore = Math.max(...names.map(n => similarity(n, contactName)));
      return { contact: c, score: maxScore };
    })
    .sort((a, b) => b.score - a.score);
  
  const best = scored[0].contact;
  const phone = best.phoneNumbers?.[0];
  if (!phone?.number) return null;
  
  // Prefer mobile numbers if available
  const mobilePhone = best.phoneNumbers?.find(
    p => p.label?.toLowerCase().includes('mobile') || p.label?.toLowerCase().includes('cell')
  );
  
  const selectedPhone = mobilePhone || phone;
  
  return {
    id: best.id || '',
    name: best.name || `${best.firstName || ''} ${best.lastName || ''}`.trim(),
    phoneNumber: normalizePhoneNumber(selectedPhone.number || ''),
    phoneType: selectedPhone.label,
  };
}

/**
 * Search for multiple contacts matching a name
 * Returns up to 5 matches for disambiguation
 */
export async function searchContactsForConversation(
  contactName: string,
  limit = 5
): Promise<ResolvedContact[]> {
  const hasPermission = await ensurePermission();
  if (!hasPermission) return [];
  
  const { data: contacts } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers,
    ],
    name: contactName,
  });
  
  return contacts
    .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
    .slice(0, limit)
    .map(c => {
      const phone = c.phoneNumbers?.[0];
      return {
        id: c.id || '',
        name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        phoneNumber: normalizePhoneNumber(phone?.number || ''),
        phoneType: phone?.label,
      };
    });
}
