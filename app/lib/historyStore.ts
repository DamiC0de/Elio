/**
 * US-008 — Conversation History Store
 * AsyncStorage-based with 20 entries max and 24h TTL
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HistoryEntry {
  id: string;
  userText: string;
  assistantText: string;
  timestamp: number;
}

const HISTORY_KEY = 'conversation_history';
const MAX_ENTRIES = 20;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    
    const entries: HistoryEntry[] = JSON.parse(data);
    const now = Date.now();
    
    // Filter expired entries
    return entries.filter(e => now - e.timestamp < TTL_MS);
  } catch (error) {
    console.error('[historyStore] getHistory error:', error);
    return [];
  }
}

export async function addToHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const current = await getHistory();
    
    const newEntry: HistoryEntry = {
      ...entry,
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    };
    
    const updated = [newEntry, ...current].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[historyStore] addToHistory error:', error);
  }
}

export async function deleteFromHistory(id: string): Promise<void> {
  try {
    const current = await getHistory();
    const updated = current.filter(e => e.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[historyStore] deleteFromHistory error:', error);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('[historyStore] clearHistory error:', error);
  }
}
