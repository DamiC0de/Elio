import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Screen, Text, Card } from '../../components/ui';
import { Colors } from '../../constants/colors';

const SERVICES = [
  { id: 'gmail', name: 'Gmail', icon: '📧', status: 'disconnected', category: 'Communication' },
  { id: 'calendar', name: 'Google Calendar', icon: '📅', status: 'disconnected', category: 'Productivité' },
  { id: 'contacts', name: 'Contacts', icon: '👥', status: 'disconnected', category: 'Productivité' },
  { id: 'spotify', name: 'Spotify', icon: '🎵', status: 'disconnected', category: 'Divertissement' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', status: 'coming_soon', category: 'Communication' },
] as const;

export default function ServicesScreen() {
  return (
    <Screen>
      <FlatList
        data={SERVICES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.serviceCard}>
            <View style={styles.serviceRow}>
              <Text variant="heading" style={styles.icon}>{item.icon}</Text>
              <View style={styles.serviceInfo}>
                <Text variant="subheading">{item.name}</Text>
                <Text variant="caption">
                  {item.status === 'coming_soon' ? 'Bientôt disponible' : 'Non connecté'}
                </Text>
              </View>
              <View style={[styles.statusBadge, item.status === 'coming_soon' && styles.comingSoon]}>
                <Text variant="caption" color={Colors.white}>
                  {item.status === 'coming_soon' ? 'Soon' : 'Connecter'}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  serviceCard: {
    marginBottom: 0,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 28,
  },
  serviceInfo: {
    flex: 1,
    gap: 2,
  },
  statusBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  comingSoon: {
    backgroundColor: Colors.textLight,
  },
});
