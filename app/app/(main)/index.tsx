/**
 * DIVA — Main Screen with Mascot Orb
 * 2026 Design: Dark-first, Lucide icons, mascot-centered
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, History, Wifi, WifiOff, MessageCircle } from 'lucide-react-native';
import { OrbView } from '../../components/Orb/OrbView';
import { TranscriptOverlay } from '../../components/TranscriptOverlay';
import { ErrorOverlay } from '../../components/ErrorOverlay';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const STATE_HINTS: Record<string, string> = {
  idle: 'Appuie pour parler',
  listening: 'Je t\'écoute...',
  processing: 'Je réfléchis...',
  speaking: '',
  error: 'Réessaie',
};

export default function OrbScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const { isConnected: isNetworkConnected } = useNetworkStatus();
  const { settings, updateSetting } = useSettings();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  const handleConversationModeChange = (enabled: boolean) => {
    updateSetting('voice', { ...settings.voice, conversationMode: enabled });
  };

  const {
    orbState,
    transcript,
    transcriptRole,
    audioLevel,
    toggleSession,
    cancel,
    isConnected: isWsConnected,
    error,
    clearError,
    isConversationActive,
  } = useVoiceSession({ 
    token, 
    isNetworkConnected,
    conversationMode: settings.voice.conversationMode,
    onConversationModeChange: handleConversationModeChange,
  });

  const isDark = theme.statusBar === 'light';

  return (
    <View style={styles.container}>
      {/* Gradient background */}
      <LinearGradient
        colors={isDark 
          ? [theme.bgGradientStart, theme.bgGradientEnd, '#0D0D18']
          : [theme.bgGradientStart, theme.bgGradientEnd]
        }
        style={StyleSheet.absoluteFill}
        locations={isDark ? [0, 0.5, 1] : [0, 1]}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.brandText, { color: theme.text }]}>diva</Text>
          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => router.push('/history')} 
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  opacity: pressed ? 0.6 : 1 
                }
              ]}
            >
              <History size={20} color={theme.textSecondary} strokeWidth={1.5} />
            </Pressable>
            <Pressable 
              onPress={() => router.push('/settings')} 
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  opacity: pressed ? 0.6 : 1 
                }
              ]}
            >
              <Settings size={20} color={theme.textSecondary} strokeWidth={1.5} />
            </Pressable>
          </View>
        </View>

        {/* Status indicators */}
        <View style={styles.statusRow}>
          {!isNetworkConnected && (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 59, 48, 0.15)' }]}>
              <WifiOff size={14} color={theme.error} strokeWidth={2} />
              <Text style={[styles.statusText, { color: theme.error }]}>Hors ligne</Text>
            </View>
          )}
          {isConversationActive && isNetworkConnected && (
            <View style={[styles.statusBadge, { backgroundColor: theme.primarySoft }]}>
              <MessageCircle size={14} color={theme.primary} strokeWidth={2} />
              <Text style={[styles.statusText, { color: theme.primary }]}>Conversation</Text>
            </View>
          )}
          {!isWsConnected && isNetworkConnected && token && (
            <View style={[styles.statusBadge, { backgroundColor: theme.primarySoft }]}>
              <Wifi size={14} color={theme.primary} strokeWidth={2} />
              <Text style={[styles.statusText, { color: theme.primary }]}>Connexion...</Text>
            </View>
          )}
        </View>

        {/* Main orb area */}
        <View style={styles.orbContainer}>
          <OrbView
            state={orbState}
            audioLevel={audioLevel}
            onPress={toggleSession}
          />
        </View>

        {/* State hint */}
        <View style={styles.hintContainer}>
          {STATE_HINTS[orbState] ? (
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {STATE_HINTS[orbState]}
            </Text>
          ) : null}
        </View>

        {/* Transcript */}
        <View style={styles.transcriptContainer}>
          <TranscriptOverlay 
            text={transcript} 
            role={transcriptRole}
            isStreaming={orbState === 'speaking' && transcriptRole === 'assistant'}
          />
        </View>

        {/* Error overlay */}
        <ErrorOverlay
          error={error}
          onRetry={toggleSession}
          onDismiss={clearError}
        />

        <View style={{ height: insets.bottom + 20 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  brandText: {
    fontSize: 28,
    fontWeight: '200',
    letterSpacing: 8,
    textTransform: 'lowercase',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Orb
  orbContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hint
  hintContainer: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.5,
  },

  // Transcript
  transcriptContainer: {
    minHeight: 100,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
