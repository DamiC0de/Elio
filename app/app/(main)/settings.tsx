import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Screen, Text, Card, Button } from '../../components/ui';
import { Colors } from '../../constants/colors';

export default function SettingsScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Compte */}
        <Text variant="caption" style={styles.sectionTitle}>COMPTE</Text>
        <Card>
          <SettingRow label="Prénom" value="—" />
          <SettingRow label="Email" value="—" />
          <SettingRow label="Abonnement" value="Free" />
        </Card>

        {/* Personnalité */}
        <Text variant="caption" style={styles.sectionTitle}>PERSONNALITÉ</Text>
        <Card>
          <SettingRow label="Ton" value="Amical" />
          <SettingRow label="Verbosité" value="Normal" />
          <SettingRow label="Tutoiement" value="Tu" />
          <SettingRow label="Humour" value="Activé" />
        </Card>

        {/* Voix */}
        <Text variant="caption" style={styles.sectionTitle}>VOIX & AUDIO</Text>
        <Card>
          <SettingRow label="Wake word" value="Hey Elio" />
          <SettingRow label="Mode" value="Manuel" />
        </Card>

        {/* À propos */}
        <Text variant="caption" style={styles.sectionTitle}>À PROPOS</Text>
        <Card>
          <SettingRow label="Version" value="0.1.0" />
        </Card>

        <View style={styles.logoutArea}>
          <Button
            title="Se déconnecter"
            onPress={() => console.log('Logout')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text variant="body">{label}</Text>
      <Text variant="body" color={Colors.textLight}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
    color: Colors.textLight,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  logoutArea: {
    marginTop: 32,
    alignItems: 'center',
  },
});
