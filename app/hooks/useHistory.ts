/**
 * US-008 — Hook to manage conversation history
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  getHistory, 
  addToHistory, 
  deleteFromHistory, 
  clearHistory, 
  HistoryEntry 
} from '../lib/historyStore';

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(data);
    } catch (error) {
      console.error('[useHistory] refresh error:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  const add = useCallback(async (userText: string, assistantText: string) => {
    await addToHistory({ userText, assistantText });
    refresh();
  }, [refresh]);
  
  const remove = useCallback(async (id: string) => {
    await deleteFromHistory(id);
    // Optimistic update
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);
  
  const clear = useCallback(async () => {
    await clearHistory();
    setHistory([]);
  }, []);
  
  return { history, loading, add, remove, clear, refresh };
}

export type { HistoryEntry };
