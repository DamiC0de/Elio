/**
 * Diva — Voice-First Main Screen (The Orb)
 * Single tap to start. Silence auto-detects. Tap to stop.
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrbView } from '../../components/Orb/OrbView';
import { TranscriptOverlay } from '../../components/TranscriptOverlay';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { useTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const STATE_HINTS: Record<string, string> = {
  idle: 'Appuie pour parler',
  listening: 'Je t\'écoute...',
  processing: 'Je réfléchis...',
  speaking: '',
  error: 'Oups, réessaye',
};

export default function OrbScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  const {
    orbState,
    transcript,
    transcriptRole,
    audioLevel,
    toggleSession,
    cancel,
    isConnected,
  } = useVoiceSession({ token });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>diva</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={20}>
          <View style={[styles.settingsBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.settingsIcon, { color: theme.textSecondary }]}>⚙</Text>
          </View>
        </Pressable>
      </View>

      {/* Connection status */}
      {!isConnected && token && (
        <View style={[styles.statusBar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.statusText, { color: theme.primary }]}>Connexion...</Text>
        </View>
      )}

      {/* Orb area */}
      <View style={styles.orbArea}>
        <OrbView
          state={orbState}
          audioLevel={audioLevel}
          onPress={toggleSession}
        />
      </View>

      {/* State hint */}
      {STATE_HINTS[orbState] ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>{STATE_HINTS[orbState]}</Text>
      ) : <View style={styles.hintSpacer} />}

      {/* Transcript */}
      <View style={styles.transcriptArea}>
        <TranscriptOverlay text={transcript} role={transcriptRole} />
      </View>

      <View style={{ height: insets.bottom + 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '200',
    letterSpacing: 6,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: { fontSize: 16 },
  statusBar: {
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 24,
    borderRadius: 8,
  },
  statusText: { fontSize: 13, fontWeight: '500' },
  orbArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { textAlign: 'center', fontSize: 15, marginBottom: 8, fontWeight: '400' },
  hintSpacer: { height: 22, marginBottom: 8 },
  transcriptArea: { minHeight: 80, justifyContent: 'center' },
});
