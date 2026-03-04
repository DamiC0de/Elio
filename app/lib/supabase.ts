import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://bastapslmagkawgmqyzh.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhc3RhcHNsbWFna2F3Z21xeXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjY4NzEsImV4cCI6MjA4NzgwMjg3MX0._iz0bnvV6RdPmi0_NPzEALw2wxZfkRvwFOH_uWk67ng';

// Wrap SecureStore to handle iOS background access errors gracefully
// "User interaction is not allowed" happens when accessing keychain in background
const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      // Silently fail for background access errors - Supabase will retry
      console.warn('[SecureStore] getItem failed (likely background):', key);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('[SecureStore] setItem failed (likely background):', key);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('[SecureStore] removeItem failed (likely background):', key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
