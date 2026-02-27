/**
 * EL-014 — Settings hook with debounced save
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../lib/api';

export interface UserSettings {
  personality: {
    tone: 'friendly' | 'professional' | 'casual';
    verbosity: 'concise' | 'normal' | 'detailed';
    formality: 'tu' | 'vous';
    humor: boolean;
  };
  voice: {
    wake_word_mode: 'always_on' | 'smart' | 'manual';
  };
  onboarding_completed: boolean;
  tutorial_completed: boolean;
  timezone: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  personality: { tone: 'friendly', verbosity: 'normal', formality: 'tu', humor: true },
  voice: { wake_word_mode: 'manual' },
  onboarding_completed: false,
  tutorial_completed: false,
  timezone: 'Europe/Paris',
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/api/v1/settings');
      if (res.data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...res.data.settings });
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updated: UserSettings) => {
    try {
      await api.patch('/api/v1/settings', { settings: updated });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const updateSetting = useCallback(<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      // Debounce save (500ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveSettings(updated), 500);
      return updated;
    });
  }, []);

  const updatePersonality = useCallback(<K extends keyof UserSettings['personality']>(
    key: K,
    value: UserSettings['personality'][K],
  ) => {
    setSettings(prev => {
      const updated = { ...prev, personality: { ...prev.personality, [key]: value } };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveSettings(updated), 500);
      return updated;
    });
  }, []);

  return { settings, loading, updateSetting, updatePersonality, reload: loadSettings };
}
