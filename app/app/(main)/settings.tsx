/**
 * DIVA Settings Screen — 2026 Design
 * Modern, fast loading, aligned with design system
 */
import React, { useState, useCallback } from 'react';
import { ScrollView, Alert, Linking, StyleSheet, View, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  User, Mic, Bell, Shield, Link2, Info, LogOut, 
  Smile, MessageSquare, Volume2, Brain, Trash2, Download, Mail, Send
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { SettingRow, SettingToggle, SettingSelect, SettingSectionHeader, SettingGroup } from '../../components/SettingRow';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { api, API_BASE_URL } from '../../lib/api';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

const TONE_OPTIONS = [
  { label: 'Amical', value: 'friendly' },
  { label: 'Pro', value: 'professional' },
  { label: 'Décontracté', value: 'casual' },
];

const VERBOSITY_OPTIONS = [
  { label: 'Concis', value: 'concise' },
  { label: 'Normal', value: 'normal' },
  { label: 'Détaillé', value: 'detailed' },
];

const WAKE_WORD_OPTIONS = [
  { label: 'Manuel', value: 'manual' },
  { label: 'Intelligent', value: 'smart' },
  { label: 'Toujours', value: 'always_on' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, loading, updatePersonality, updateSetting } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  
  // Connection statuses - lazy loaded
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Load connection statuses when screen is focused (not on mount)
  useFocusEffect(
    useCallback(() => {
      if (!statusLoaded) {
        loadConnectionStatuses();
      }
    }, [statusLoaded])
  );

  const loadConnectionStatuses = async () => {
    try {
      const [gmailRes, telegramRes] = await Promise.allSettled([
        api.get<{ email?: string }>('/api/v1/gmail/status'),
        api.get<{ username?: string }>('/api/v1/telegram/status'),
      ]);
      
      if (gmailRes.status === 'fulfilled') {
        setGmailEmail(gmailRes.value.data?.email || null);
      }
      if (telegramRes.status === 'fulfilled') {
        setTelegramUsername(telegramRes.value.data?.username || null);
      }
    } catch {
      // Silent fail
    } finally {
      setStatusLoaded(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setStatusLoaded(false);
    await loadConnectionStatuses();
    setRefreshing(false);
  };

  const handleGmailConnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Erreur', 'Connecte-toi d\'abord');
        return;
      }
      const authUrl = `${API_BASE_URL}/api/v1/gmail/auth?userId=${user.id}`;
      await WebBrowser.openBrowserAsync(authUrl);
      loadConnectionStatuses();
    } catch (err) {
      Alert.alert('Erreur', String(err));
    }
  };

  const handleGmailDisconnect = async () => {
    Alert.alert('Déconnecter Gmail', 'Tu ne pourras plus envoyer d\'emails via Diva.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        try {
          await api.post('/api/v1/gmail/disconnect');
          setGmailEmail(null);
        } catch { Alert.alert('Erreur', 'Impossible de déconnecter Gmail'); }
      }},
    ]);
  };

  const handleTelegramConnect = async () => {
    try {
      const res = await api.get<{ auth_url: string }>('/api/v1/telegram/auth');
      if (res.data?.auth_url) {
        Linking.openURL(res.data.auth_url);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'initier la connexion Telegram');
    }
  };

  const handleTelegramDisconnect = async () => {
    Alert.alert('Déconnecter Telegram', 'Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        try {
          await api.post('/api/v1/telegram/disconnect');
          setTelegramUsername(null);
        } catch { Alert.alert('Erreur', 'Impossible de déconnecter'); }
      }},
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await api.delete('/api/v1/user/delete');
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          } catch { Alert.alert('Erreur', 'Impossible de supprimer le compte'); }
        }},
      ]
    );
  };

  const handleClearMemories = () => {
    Alert.alert('Effacer les souvenirs', 'Diva oubliera tout ce qu\'elle sait sur toi.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: async () => {
        try {
          await api.delete('/api/v1/memories');
          Alert.alert('✓', 'Souvenirs effacés');
        } catch { Alert.alert('Erreur', 'Impossible d\'effacer'); }
      }},
    ]);
  };

  const iconColor = theme.textSecondary;
  const iconSize = 20;

  return (
    <Screen>
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Personnalité */}
        <SettingSectionHeader 
          title="Personnalité" 
          icon={<Smile size={16} color={theme.primary} />} 
        />
        <SettingGroup>
          <SettingSelect
            label="Ton"
            options={TONE_OPTIONS}
            selected={settings.personality.tone}
            onSelect={(v) => updatePersonality('tone', v)}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingSelect
            label="Verbosité"
            options={VERBOSITY_OPTIONS}
            selected={settings.personality.verbosity}
            onSelect={(v) => updatePersonality('verbosity', v)}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingToggle
            label="Humour"
            description="Diva peut faire de l'humour"
            value={settings.personality.humor}
            onToggle={(v) => updatePersonality('humor', v)}
          />
        </SettingGroup>

        {/* Voix */}
        <SettingSectionHeader 
          title="Voix & Audio" 
          icon={<Mic size={16} color={theme.primary} />} 
        />
        <SettingGroup>
          <SettingSelect
            label="Mode activation"
            options={WAKE_WORD_OPTIONS}
            selected={settings.voice.wake_word_mode}
            onSelect={(v) => updateSetting('voice', { ...settings.voice, wake_word_mode: v as 'always_on' | 'smart' | 'manual' })}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingToggle
            label="Mode conversation"
            description="Continue d'écouter après chaque réponse"
            value={settings.voice.conversationMode}
            onToggle={(v) => updateSetting('voice', { ...settings.voice, conversationMode: v })}
          />
        </SettingGroup>

        {/* Services connectés */}
        <SettingSectionHeader 
          title="Services connectés" 
          icon={<Link2 size={16} color={theme.primary} />} 
        />
        <SettingGroup>
          <SettingRow
            label="Gmail"
            icon={<Mail size={iconSize} color={iconColor} />}
            value={gmailEmail ? `✓ ${gmailEmail}` : 'Non connecté'}
            onPress={gmailEmail ? handleGmailDisconnect : handleGmailConnect}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingRow
            label="Telegram"
            icon={<Send size={iconSize} color={iconColor} />}
            value={telegramUsername ? `✓ @${telegramUsername}` : 'Non connecté'}
            onPress={telegramUsername ? handleTelegramDisconnect : handleTelegramConnect}
          />
        </SettingGroup>

        {/* Confidentialité */}
        <SettingSectionHeader 
          title="Confidentialité" 
          icon={<Shield size={16} color={theme.primary} />} 
        />
        <SettingGroup>
          <SettingRow
            label="Voir mes souvenirs"
            icon={<Brain size={iconSize} color={iconColor} />}
            onPress={async () => {
              try {
                const res = await api.get<{ memories?: { category: string; content: string }[] }>('/api/v1/memories');
                const memories = res.data?.memories || [];
                const items = memories.slice(0, 5).map((m) => `• ${m.content}`).join('\n');
                Alert.alert(`${memories.length} souvenir(s)`, items || 'Aucun souvenir');
              } catch { Alert.alert('Erreur', 'Impossible de charger'); }
            }}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingRow
            label="Effacer mes souvenirs"
            icon={<Trash2 size={iconSize} color={theme.error} />}
            onPress={handleClearMemories}
            danger
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingRow
            label="Exporter mes données"
            icon={<Download size={iconSize} color={iconColor} />}
            onPress={() => Alert.alert('Export', 'Fonctionnalité à venir')}
          />
        </SettingGroup>

        {/* À propos */}
        <SettingSectionHeader 
          title="À propos" 
          icon={<Info size={16} color={theme.primary} />} 
        />
        <SettingGroup>
          <SettingRow label="Version" value="1.0.0" />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <SettingRow 
            label="Contacter le support" 
            onPress={() => Linking.openURL('mailto:contact@diva-ai.app')} 
          />
        </SettingGroup>

        {/* Compte */}
        <SettingSectionHeader 
          title="Compte" 
          icon={<User size={16} color={theme.primary} />} 
        />
        <SettingGroup>
          <SettingRow
            label="Supprimer mon compte"
            icon={<Trash2 size={iconSize} color={theme.error} />}
            onPress={handleDeleteAccount}
            danger
          />
        </SettingGroup>

        {/* Déconnexion */}
        <View style={styles.logoutContainer}>
          <Button
            title="Se déconnecter"
            onPress={handleLogout}
            style={[styles.logoutBtn, { backgroundColor: theme.bgSecondary }]}
            textStyle={{ color: theme.error }}
          />
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  divider: { height: 1, marginLeft: 16 },
  logoutContainer: { marginTop: 32, paddingHorizontal: 16 },
  logoutBtn: { borderRadius: 14 },
  footer: { height: 40 },
});
