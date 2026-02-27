/**
 * EL-029 — Onboarding Flow (4 steps)
 */
import React, { useRef, useState } from 'react';
import {
  View, FlatList, Dimensions, TextInput, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface OnboardingData {
  name: string;
  formality: 'tu' | 'vous';
  tone: 'friendly' | 'professional' | 'casual';
}

export default function OnboardingScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [data, setData] = useState<OnboardingData>({ name: '', formality: 'tu', tone: 'friendly' });
  const scrollX = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    if (currentPage < 3) {
      flatListRef.current?.scrollToIndex({ index: currentPage + 1 });
      setCurrentPage(currentPage + 1);
    }
  };

  const finish = async () => {
    // TODO: Save settings via API + mark onboarding_completed
    // await api.patch('/api/v1/settings', { settings: { ...data, onboarding_completed: true } });
    router.replace('/(main)');
  };

  const pages = [
    // Page 1: Welcome
    <View key="welcome" style={styles.page}>
      <Text style={styles.emoji}>🌅</Text>
      <Text style={styles.title}>Bienvenue sur Elio</Text>
      <Text style={styles.subtitle}>
        Ton assistant intelligent qui comprend ta voix, gère tes emails, ton agenda, et bien plus encore.
      </Text>
      <Button title="Commencer" onPress={goNext} style={styles.btn} />
    </View>,

    // Page 2: Permissions
    <View key="permissions" style={styles.page}>
      <Text style={styles.emoji}>🎙️</Text>
      <Text style={styles.title}>Permissions</Text>
      <Text style={styles.subtitle}>
        Elio a besoin de ton micro pour la conversation vocale et des notifications pour les rappels.
      </Text>
      <Button
        title="🎙️ Autoriser le micro"
        onPress={async () => {
          // TODO: Audio.requestPermissionsAsync()
          goNext();
        }}
        style={styles.btn}
      />
      <Button
        title="🔔 Autoriser les notifications"
        variant="outline"
        onPress={async () => {
          // TODO: Notifications.requestPermissionsAsync()
          goNext();
        }}
        style={styles.btnSecondary}
      />
      <TouchableOpacity onPress={goNext}>
        <Text style={styles.skip}>Passer</Text>
      </TouchableOpacity>
    </View>,

    // Page 3: Personalization
    <View key="personalization" style={styles.page}>
      <Text style={styles.emoji}>✨</Text>
      <Text style={styles.title}>Comment t'appeler ?</Text>
      <TextInput
        style={styles.input}
        placeholder="Ton prénom"
        placeholderTextColor="#aaa"
        value={data.name}
        onChangeText={(t) => setData(d => ({ ...d, name: t }))}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Tu ou Vous ?</Text>
      <View style={styles.toggleRow}>
        {(['tu', 'vous'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, data.formality === f && styles.chipActive]}
            onPress={() => setData(d => ({ ...d, formality: f }))}
          >
            <Text style={[styles.chipText, data.formality === f && styles.chipTextActive]}>
              {f === 'tu' ? '👋 Tu' : '🤝 Vous'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Ton préféré</Text>
      <View style={styles.toggleRow}>
        {[
          { value: 'friendly', label: '😊 Amical' },
          { value: 'professional', label: '👔 Pro' },
          { value: 'casual', label: '😎 Cool' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, data.tone === opt.value && styles.chipActive]}
            onPress={() => setData(d => ({ ...d, tone: opt.value as OnboardingData['tone'] }))}
          >
            <Text style={[styles.chipText, data.tone === opt.value && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Continuer" onPress={goNext} style={styles.btn} />
    </View>,

    // Page 4: Services
    <View key="services" style={styles.page}>
      <Text style={styles.emoji}>📧</Text>
      <Text style={styles.title}>Connecter tes services</Text>
      <Text style={styles.subtitle}>
        Connecte tes comptes pour qu'Elio puisse gérer tes emails, ton agenda et ta musique.
      </Text>

      {[
        { icon: '📧', name: 'Gmail', desc: 'Lire et envoyer des emails' },
        { icon: '📅', name: 'Google Calendar', desc: 'Gérer ton agenda' },
        { icon: '🎵', name: 'Spotify', desc: 'Contrôler ta musique' },
      ].map(service => (
        <TouchableOpacity key={service.name} style={styles.serviceCard}>
          <Text style={styles.serviceIcon}>{service.icon}</Text>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDesc}>{service.desc}</Text>
          </View>
          <Text style={styles.connectBtn}>Connecter</Text>
        </TouchableOpacity>
      ))}

      <Button title="Terminer 🚀" onPress={finish} style={styles.btn} />
      <TouchableOpacity onPress={finish}>
        <Text style={styles.skip}>Plus tard</Text>
      </TouchableOpacity>
    </View>,
  ];

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={({ item }) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
      />
      {/* Pagination dots */}
      <View style={styles.dots}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.dot, currentPage === i && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { width, flex: 1, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  btn: { width: '100%', marginTop: 16 },
  btnSecondary: { width: '100%', marginTop: 8 },
  skip: { color: '#888', fontSize: 15, marginTop: 16 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 16, fontSize: 18, backgroundColor: '#fff', marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, alignSelf: 'flex-start' },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  chip: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 15, color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 48, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', marginBottom: 10 },
  serviceIcon: { fontSize: 28, marginRight: 12 },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: '600' },
  serviceDesc: { fontSize: 13, color: '#888' },
  connectBtn: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
