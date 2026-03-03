import React, { useEffect, useState } from 'react';
import { Slot, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Required for OAuth redirects to work in Expo Go
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        router.replace('/(auth)/login');
      }
      // Don't auto-navigate on auth change — let the loading effect handle routing
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (session) {
        // Check if onboarding completed
        const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://72.60.155.227:4000';
        fetch(`${API_URL}/api/v1/settings`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
          .then(r => r.json())
          .then(data => {
            if (data.settings?.onboarding_completed) {
              router.replace('/(main)');
            } else {
              router.replace('/(onboarding)');
            }
          })
          .catch(() => router.replace('/(main)'));
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [loading, session]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Slot />
    </SafeAreaProvider>
  );
}
