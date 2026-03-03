/**
 * EL-019 — Contacts iOS integration
 * On-device contact search (never sent to server in bulk)
 */
import * as Contacts from 'expo-contacts';
import { Linking, Alert } from 'react-native';

export interface ContactResult {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phones: string[];
  emails: string[];
}

/**
 * Request contacts permission
 */
export async function requestPermission(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if we have contacts permission
 */
export async function hasPermission(): Promise<boolean> {
  const { status } = await Contacts.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Search contacts by name (fuzzy match)
 * Returns max 5 results to keep response small
 */
export async function searchContacts(query: string): Promise<ContactResult[]> {
  const permitted = await hasPermission();
  if (!permitted) {
    const granted = await requestPermission();
    if (!granted) {
      throw new Error('Permission contacts refusée');
    }
  }

  // Fetch contacts with name containing query
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
    ],
    name: query, // Expo's built-in filtering
  });

  // Map to our format, limit to 5
  const results: ContactResult[] = data.slice(0, 5).map((contact) => ({
    id: contact.id || '',
    name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    firstName: contact.firstName || undefined,
    lastName: contact.lastName || undefined,
    phones: (contact.phoneNumbers || []).map((p) => p.number || '').filter(Boolean),
    emails: (contact.emails || []).map((e) => e.email || '').filter(Boolean),
  }));

  return results;
}

/**
 * Get a specific contact by ID
 */
export async function getContactById(contactId: string): Promise<ContactResult | null> {
  const permitted = await hasPermission();
  if (!permitted) return null;

  const contact = await Contacts.getContactByIdAsync(contactId, [
    Contacts.Fields.FirstName,
    Contacts.Fields.LastName,
    Contacts.Fields.PhoneNumbers,
    Contacts.Fields.Emails,
  ]);

  if (!contact) return null;

  return {
    id: contact.id || '',
    name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    firstName: contact.firstName || undefined,
    lastName: contact.lastName || undefined,
    phones: (contact.phoneNumbers || []).map((p) => p.number || '').filter(Boolean),
    emails: (contact.emails || []).map((e) => e.email || '').filter(Boolean),
  };
}

/**
 * Format contacts for Claude context
 */
export function formatContactsForContext(contacts: ContactResult[]): string {
  if (contacts.length === 0) {
    return 'Aucun contact trouvé.';
  }

  return contacts
    .map((c, i) => {
      const parts = [`${i + 1}. ${c.name}`];
      if (c.phones.length > 0) parts.push(`   Tél: ${c.phones[0]}`);
      if (c.emails.length > 0) parts.push(`   Email: ${c.emails[0]}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * Initiate a phone call
 */
export async function callPhone(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `tel:${phoneNumber.replace(/\s/g, '')}`;
    const supported = await Linking.canOpenURL(url);
    
    if (!supported) {
      return { success: false, error: "Les appels ne sont pas supportés sur cet appareil" };
    }

    await Linking.openURL(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Open email composer
 */
export async function openEmailComposer(email: string, subject?: string, body?: string): Promise<{ success: boolean; error?: string }> {
  try {
    let url = `mailto:${email}`;
    const params: string[] = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return { success: false, error: "L'email n'est pas configuré sur cet appareil" };
    }

    await Linking.openURL(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
