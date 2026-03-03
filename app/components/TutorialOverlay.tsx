/**
 * EL-030 — Interactive Tutorial Overlay
 * Shows tooltips highlighting UI elements on first use
 */
import React, { useState } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { colors } from '../constants/colors';

const { width, height } = Dimensions.get('window');

interface TutorialStep {
  title: string;
  description: string;
  highlightArea: { x: number; y: number; width: number; height: number };
  position: 'top' | 'bottom';
}

const STEPS: Omit<TutorialStep, 'highlightArea'>[] = [
  {
    title: '🎙️ Parler à Diva',
    description: 'Maintiens ce bouton pour parler à Diva. Relâche quand tu as fini.',
    position: 'top',
  },
  {
    title: '💬 Tes conversations',
    description: 'Les réponses de Diva et tes messages apparaissent ici.',
    position: 'bottom',
  },
  {
    title: '⌨️ Mode texte',
    description: 'Tu peux aussi taper tes messages si tu préfères.',
    position: 'top',
  },
  {
    title: '🚀 Essaie !',
    description: 'Demande la météo, lis tes mails, ou crée un rappel. Diva est prête !',
    position: 'bottom',
  },
];

const SUGGESTIONS = [
  '☀️ Quel temps fait-il ?',
  '📧 Lis-moi mes mails',
  '📅 C\'est quoi mon agenda ?',
  '⏰ Rappelle-moi de...',
  '🎵 Mets de la musique',
];

interface Props {
  userName: string;
  onComplete: () => void;
}

export function TutorialOverlay({ userName, onComplete }: Props) {
  const [step, setStep] = useState(0);

  const isLastStep = step >= STEPS.length;

  if (isLastStep) {
    // Show suggestions card
    return (
      <View style={styles.overlay}>
        <View style={styles.suggestionsCard}>
          <Text style={styles.suggestTitle}>
            Bravo {userName} ! 🎉
          </Text>
          <Text style={styles.suggestSubtitle}>
            Voici quelques idées pour commencer :
          </Text>
          {SUGGESTIONS.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestionChip} onPress={onComplete}>
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.doneBtn} onPress={onComplete}>
            <Text style={styles.doneBtnText}>C'est parti ! 🚀</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const current = STEPS[step]!;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.overlayTouch}
        activeOpacity={1}
        onPress={() => setStep(s => s + 1)}
      >
        <View style={[styles.tooltip, current.position === 'top' ? styles.tooltipTop : styles.tooltipBottom]}>
          <Text style={styles.tooltipTitle}>{current.title}</Text>
          <Text style={styles.tooltipDesc}>{current.description}</Text>
          <Text style={styles.tapHint}>Tap pour continuer ({step + 1}/{STEPS.length})</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={onComplete}>
        <Text style={styles.skipText}>Passer le tutorial</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  overlayTouch: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  tooltip: { backgroundColor: '#fff', borderRadius: 16, padding: 24, marginHorizontal: 32, maxWidth: 340 },
  tooltipTop: { marginTop: 'auto', marginBottom: 120 },
  tooltipBottom: { marginTop: 120, marginBottom: 'auto' },
  tooltipTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  tooltipDesc: { fontSize: 16, color: '#555', lineHeight: 24 },
  tapHint: { fontSize: 13, color: '#aaa', marginTop: 12, textAlign: 'center' },
  skipBtn: { position: 'absolute', bottom: 48, alignSelf: 'center' },
  skipText: { color: '#fff', fontSize: 15, opacity: 0.7 },
  suggestionsCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, marginHorizontal: 24, alignItems: 'center' },
  suggestTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  suggestSubtitle: { fontSize: 15, color: '#666', marginBottom: 16 },
  suggestionChip: { backgroundColor: colors.background, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, width: '100%', marginBottom: 8 },
  suggestionText: { fontSize: 15, color: '#1a1a1a' },
  doneBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginTop: 12 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
