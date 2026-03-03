/**
 * EL-014 — Settings Screen (dark mode, Diva)
 */
import React, { useState, useEffect } from 'react';
import { ScrollView, Alert, Linking, StyleSheet } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { SettingRow, SettingToggle, SettingSelect, SettingSectionHeader } from '../../components/SettingRow';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { api, API_BASE_URL } from '../../lib/api';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

const TONE_OPTIONS = [
  { label: '😊 Amical', value: 'friendly' },
  { label: '👔 Pro', value: 'professional' },
  { label: '😎 Décontracté', value: 'casual' },
];

const VERBOSITY_OPTIONS = [
  { label: 'Concis', value: 'concise' },
  { label: 'Normal', value: 'normal' },
  { label: 'Détaillé', value: 'detailed' },
];

const WAKE_WORD_OPTIONS = [
  { label: 'Manuel', value: 'manual' },
  { label: 'Intelligent', value: 'smart' },
  { label: 'Toujours actif', value: 'always_on' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, loading, updatePersonality, updateSetting } = useSettings();
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);

  // Check connection statuses on mount
  useEffect(() => {
    checkGmailStatus();
    checkTelegramStatus();
  }, []);

  const checkGmailStatus = async () => {
    try {
      const res = await api.get('/api/v1/gmail/status');
      setGmailEmail(res.data?.email || null);
    } catch {
      setGmailEmail(null);
    }
  };

  const handleGmailConnect = async () => {
    setGmailLoading(true);
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Erreur', 'Tu dois être connecté');
        return;
      }

      // Open browser for OAuth flow
      const authUrl = `${API_BASE_URL}/api/v1/gmail/auth?userId=${user.id}`;
      const result = await WebBrowser.openBrowserAsync(authUrl);
      
      // After browser closes, check status
      if (result.type === 'cancel' || result.type === 'dismiss') {
        await checkGmailStatus();
        if (gmailEmail) {
          Alert.alert('Gmail connecté', `Connecté en tant que ${gmailEmail}`);
        }
      }
    } catch (err) {
      Alert.alert('Erreur', String(err));
    } finally {
      setGmailLoading(false);
    }
  };

  const handleGmailDisconnect = () => {
    Alert.alert('Déconnecter Gmail', 'Diva ne pourra plus lire ni envoyer tes emails.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/api/v1/gmail/disconnect');
            setGmailEmail(null);
          } catch (err) {
            Alert.alert('Erreur', String(err));
          }
        },
      },
    ]);
  };

  const checkTelegramStatus = async () => {
    try {
      const res = await api.get('/api/v1/telegram/user/status');
      setTelegramUsername(res.data?.connected ? 'Connecté' : null);
    } catch {
      setTelegramUsername(null);
    }
  };

  const handleTelegramConnect = async () => {
    // Prompt for phone number
    Alert.prompt(
      'Connecter Telegram',
      'Entre ton numéro de téléphone (format international, ex: +33612345678)',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer le code',
          onPress: async (phoneNumber) => {
            if (!phoneNumber) return;
            
            try {
              const res = await api.post('/api/v1/telegram/user/auth/start', { phoneNumber });
              if (res.data?.success) {
                // Prompt for code
                setTimeout(() => {
                  Alert.prompt(
                    'Code de vérification',
                    'Entre le code reçu sur Telegram',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Vérifier',
                        onPress: async (code) => {
                          if (!code) return;
                          
                          try {
                            const verifyRes = await api.post('/api/v1/telegram/user/auth/complete', {
                              phoneNumber,
                              code,
                            });
                            
                            if (verifyRes.data?.error === '2FA_REQUIRED') {
                              // Handle 2FA
                              Alert.prompt(
                                'Authentification 2FA',
                                'Entre ton mot de passe Telegram',
                                [
                                  { text: 'Annuler', style: 'cancel' },
                                  {
                                    text: 'Confirmer',
                                    onPress: async (password) => {
                                      const twoFaRes = await api.post('/api/v1/telegram/user/auth/complete', {
                                        phoneNumber,
                                        code,
                                        password,
                                      });
                                      if (twoFaRes.data?.success) {
                                        Alert.alert('Succès', 'Telegram connecté !');
                                        checkTelegramStatus();
                                      } else {
                                        Alert.alert('Erreur', twoFaRes.data?.error || 'Échec de connexion');
                                      }
                                    },
                                  },
                                ],
                                'secure-text'
                              );
                            } else if (verifyRes.data?.success) {
                              Alert.alert('Succès', 'Telegram connecté !');
                              checkTelegramStatus();
                            } else {
                              Alert.alert('Erreur', verifyRes.data?.error || 'Échec de vérification');
                            }
                          } catch (err) {
                            Alert.alert('Erreur', String(err));
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                }, 500);
              } else {
                Alert.alert('Erreur', res.data?.error || 'Échec de l\'envoi du code');
              }
            } catch (err) {
              Alert.alert('Erreur', String(err));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleTelegramDisconnect = () => {
    Alert.alert('Déconnecter Telegram', 'Diva ne pourra plus lire tes messages Telegram.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/api/v1/telegram/user/disconnect');
            setTelegramUsername(null);
          } catch (err) {
            Alert.alert('Erreur', String(err));
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Se déconnecter', 'Es-tu sûr(e) ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes tes données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Confirmer', 'Dernière chance. Supprimer définitivement ?', [
              { text: 'Non', style: 'cancel' },
              {
                text: 'Oui, supprimer',
                style: 'destructive',
                onPress: async () => {
                  await supabase.auth.signOut();
                  router.replace('/(auth)/login');
                },
              },
            ]);
          },
        },
      ],
    );
  };

  if (loading) return <Screen><></></Screen>;

  return (
    <Screen>
      <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Personnalité */}
        <SettingSectionHeader title="Personnalité de Diva" />
        <SettingSelect
          label="Ton"
          options={TONE_OPTIONS}
          selected={settings.personality.tone}
          onSelect={(v) => updatePersonality('tone', v as 'friendly' | 'professional' | 'casual')}
        />
        <SettingSelect
          label="Verbosité"
          options={VERBOSITY_OPTIONS}
          selected={settings.personality.verbosity}
          onSelect={(v) => updatePersonality('verbosity', v as 'concise' | 'normal' | 'detailed')}
        />
        <SettingToggle
          label="Tutoiement"
          description="Diva te tutoie"
          value={settings.personality.formality === 'tu'}
          onToggle={(v) => updatePersonality('formality', v ? 'tu' : 'vous')}
        />
        <SettingToggle
          label="Humour"
          description="Diva peut faire de l'humour"
          value={settings.personality.humor}
          onToggle={(v) => updatePersonality('humor', v)}
        />

        {/* Voix & Audio */}
        <SettingSectionHeader title="Voix & Audio" />
        <SettingSelect
          label="Mode wake word"
          options={WAKE_WORD_OPTIONS}
          selected={settings.voice.wake_word_mode}
          onSelect={(v) => updateSetting('voice', { ...settings.voice, wake_word_mode: v as 'always_on' | 'smart' | 'manual' })}
        />

        {/* Abonnement */}
        <SettingSectionHeader title="Abonnement" />
        <SettingRow label="Plan actuel" value="Free" />
        <SettingRow
          label="Gérer l'abonnement"
          onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}
        />

        {/* Confidentialité */}
        <SettingSectionHeader title="Confidentialité" />
        <SettingRow label="Effacer mes souvenirs" onPress={() => {
          Alert.alert('Effacer les souvenirs', 'Diva oubliera tout ce qu\'elle sait sur toi.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Effacer', style: 'destructive', onPress: async () => {
              try {
                await api.delete('/api/v1/memories');
                Alert.alert('Fait', 'Tous les souvenirs ont été effacés.');
              } catch { Alert.alert('Erreur', 'Impossible d\'effacer les souvenirs.'); }
            }},
          ]);
        }} />
        <SettingRow label="Voir mes souvenirs" onPress={async () => {
          try {
            const res = await api.get('/api/v1/memories');
            const count = res.data?.memories?.length ?? 0;
            const items = (res.data?.memories || []).slice(0, 10).map((m: any) => `[${m.category}] ${m.content}`).join('\n');
            Alert.alert(`${count} souvenir(s)`, items || 'Aucun souvenir pour le moment');
          } catch { Alert.alert('Erreur', 'Impossible de charger les souvenirs'); }
        }} />
        <SettingRow label="Effacer tous mes souvenirs" onPress={() => {
          Alert.alert('Effacer les souvenirs', 'Diva oubliera tout ce qu\'elle sait sur toi. Continuer ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Tout effacer', style: 'destructive', onPress: async () => {
              try {
                await api.delete('/api/v1/memories');
                Alert.alert('Fait', 'Tous les souvenirs ont été effacés');
              } catch { Alert.alert('Erreur', 'Impossible d\'effacer les souvenirs'); }
            }},
          ]);
        }} />
        <SettingRow label="Exporter mes données" onPress={() => Alert.alert('Export', 'Fonctionnalité à venir')} />
        <SettingRow label="Supprimer mon compte" onPress={handleDeleteAccount} />

        {/* Services connectés */}
        <SettingSectionHeader title="Services connectés" />
        <SettingRow
          label="Gmail"
          value={gmailEmail ? `✅ ${gmailEmail}` : '❌ Non connecté'}
          onPress={gmailEmail ? handleGmailDisconnect : handleGmailConnect}
        />
        <SettingRow
          label="Telegram"
          value={telegramUsername ? `✅ @${telegramUsername}` : '❌ Non connecté'}
          onPress={telegramUsername ? handleTelegramDisconnect : handleTelegramConnect}
        />

        {/* À propos */}
        <SettingSectionHeader title="À propos" />
        <SettingRow label="Version" value="1.0.0 (MVP)" />
        <SettingRow label="Contact support" onPress={() => Linking.openURL('mailto:contact@diva-ai.app')} />

        {/* Déconnexion */}
        <Button
          title="Se déconnecter"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoutBtn: { margin: 24, marginBottom: 48 },
});
