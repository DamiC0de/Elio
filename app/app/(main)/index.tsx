import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, Text, Button } from '../../components/ui';
import { Colors } from '../../constants/colors';

export default function ConversationScreen() {
  const handlePTT = () => {
    // TODO: EL-013 — Push-to-talk + WebSocket audio
    console.log('PTT pressed');
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Message area - placeholder */}
        <View style={styles.messageArea}>
          <Text variant="body" color={Colors.textLight} style={styles.emptyText}>
            Appuie sur le micro pour parler à Elio 🎙️
          </Text>
        </View>

        {/* Status bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text variant="caption">Prêt</Text>
        </View>

        {/* PTT Button */}
        <View style={styles.pttArea}>
          <Button
            title="🎙️ Maintenir pour parler"
            onPress={handlePTT}
            style={styles.pttButton}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    textAlign: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  pttArea: {
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  pttButton: {
    borderRadius: 24,
    paddingVertical: 18,
  },
});
