import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Screen, Text, Button } from '../components/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text variant="heading">Page introuvable</Text>
        <Text variant="body" style={styles.subtitle}>
          Cette page n'existe pas.
        </Text>
        <Link href="/" asChild>
          <Button title="Retour à l'accueil" onPress={() => {}} />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  subtitle: {
    marginBottom: 16,
  },
});
