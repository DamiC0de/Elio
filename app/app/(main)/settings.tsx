/**
 * EL-014 — Settings Screen (full)
 */
import React from 'react';
import { ScrollView, Alert, Linking, StyleSheet } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { SettingRow, SettingToggle, SettingSelect, SettingSectionHeader } from '../../components/SettingRow';
import { useSettings } from '../../hooks/useSettings';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

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
  const { settings, loading, updatePersonality, updateSetting } = useSettings();

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
                  // TODO: Call DELETE /api/v1/account
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
      <ScrollView style={styles.container}>
        {/* Personnalité */}
        <SettingSectionHeader title="Personnalité d'Elio" />
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
          description="Elio te tutoie"
          value={settings.personality.formality === 'tu'}
          onToggle={(v) => updatePersonality('formality', v ? 'tu' : 'vous')}
        />
        <SettingToggle
          label="Humour"
          description="Elio peut faire de l'humour"
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
        <SettingRow label="Exporter mes données" onPress={() => Alert.alert('Export', 'Fonctionnalité à venir')} />
        <SettingRow label="Supprimer mon compte" onPress={handleDeleteAccount} />

        {/* À propos */}
        <SettingSectionHeader title="À propos" />
        <SettingRow label="Version" value="1.0.0 (MVP)" />
        <SettingRow label="Mentions légales" onPress={() => Linking.openURL('https://elio.ai/legal')} />
        <SettingRow label="Politique de confidentialité" onPress={() => Linking.openURL('https://elio.ai/privacy')} />
        <SettingRow label="Contact support" onPress={() => Linking.openURL('mailto:support@elio.ai')} />

        {/* Déconnexion */}
        <Button
          title="Se déconnecter"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  logoutBtn: { margin: 24, marginBottom: 48 },
});
