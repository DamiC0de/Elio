/**
 * EL-029 — Onboarding Screens (4 steps)
 */

import React, { useState, useRef } from 'react';
import {
  View, StyleSheet, FlatList, Dimensions, TextInput, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Button } from '../../components/ui';
import { useTheme, Theme } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface OnboardingStep {
  id: string;
  title: string;
  content: React.ReactNode;
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [useTu, setUseTu] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      // Finish onboarding
      // TODO: save settings + set onboarding_completed = true
      router.replace('/(main)');
    }
  };

  const s = getStyles(theme);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: '',
      content: (
        <View style={s.stepContent}>
          <Text variant="hero" color={theme.primary} style={s.centerText}>
            🌅
          </Text>
          <Text variant="hero" style={s.centerText}>Diva</Text>
          <Text variant="body" color={theme.textSecondary} style={s.centerText}>
            Ton assistant vocal intelligent.{'\n'}
            Il gère tes emails, ton agenda, et bien plus — par la voix.
          </Text>
        </View>
      ),
    },
    {
      id: 'permissions',
      title: 'Autorisations',
      content: (
        <View style={s.stepContent}>
          <Text variant="heading" style={s.centerText}>
            Pour fonctionner, Diva a besoin de :
          </Text>
          <View style={s.permissionList}>
            <PermissionItem
              icon="🎙️"
              title="Microphone"
              desc="Pour écouter tes demandes vocales"
              onPress={() => console.log('request mic')}
              theme={theme}
            />
            <PermissionItem
              icon="🔔"
              title="Notifications"
              desc="Pour tes rappels et alertes"
              onPress={() => console.log('request notifs')}
              theme={theme}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'personalize',
      title: 'Personnalisation',
      content: (
        <View style={s.stepContent}>
          <Text variant="heading" style={s.centerText}>
            Comment t'appeler ?
          </Text>
          <TextInput
            style={s.nameInput}
            placeholder="Ton prénom"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <View style={s.toggleRow}>
            <Text variant="body">Diva te tutoie ?</Text>
            <Switch
              value={useTu}
              onValueChange={setUseTu}
              trackColor={{ true: theme.primary, false: theme.divider }}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'services',
      title: 'Services',
      content: (
        <View style={s.stepContent}>
          <Text variant="heading" style={s.centerText}>
            Connecte tes services
          </Text>
          <Text variant="body" color={theme.textSecondary} style={s.centerText}>
            Tu pourras les ajouter plus tard dans les réglages.
          </Text>
          <View style={s.servicesList}>
            <ServiceItem icon="📧" name="Gmail" theme={theme} />
            <ServiceItem icon="📅" name="Google Calendar" theme={theme} />
            <ServiceItem icon="🎵" name="Spotify" theme={theme} />
          </View>
        </View>
      ),
    },
  ];

  return (
    <Screen padded={false}>
      <FlatList
        ref={flatListRef}
        data={steps}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={s.slide}>{item.content}</View>
        )}
      />

      {/* Pagination dots */}
      <View style={s.dotsRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[s.dot, i === currentStep && s.dotActive]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={s.buttonRow}>
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <Button title="Passer" onPress={goNext} variant="ghost" />
        )}
        <Button
          title={currentStep === steps.length - 1 ? 'C\'est parti ! 🚀' : 'Suivant'}
          onPress={goNext}
          style={s.nextButton}
        />
      </View>
    </Screen>
  );
}

function PermissionItem({ icon, title, desc, onPress, theme }: { icon: string; title: string; desc: string; onPress: () => void; theme: Theme }) {
  const s = getStyles(theme);
  return (
    <View style={s.permItem}>
      <Text variant="heading">{icon}</Text>
      <View style={s.permInfo}>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption">{desc}</Text>
      </View>
      <Button title="Autoriser" onPress={onPress} variant="secondary" style={s.permButton} />
    </View>
  );
}

function ServiceItem({ icon, name, theme }: { icon: string; name: string; theme: Theme }) {
  const s = getStyles(theme);
  return (
    <View style={s.serviceItem}>
      <Text variant="heading">{icon}</Text>
      <Text variant="body" style={s.serviceName}>{name}</Text>
      <Button title="Connecter" onPress={() => {}} variant="secondary" style={s.serviceButton} />
    </View>
  );
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    slide: { width, flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    stepContent: { gap: 16, alignItems: 'center' },
    centerText: { textAlign: 'center' },
    nameInput: {
      width: '100%', backgroundColor: theme.inputBg, borderRadius: 12,
      padding: 16, fontSize: 18, borderWidth: 1, borderColor: theme.inputBorder,
      color: theme.text, textAlign: 'center',
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8 },
    permissionList: { width: '100%', gap: 16, marginTop: 16 },
    permItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 12, padding: 16 },
    permInfo: { flex: 1 },
    permButton: { paddingVertical: 8, paddingHorizontal: 12 },
    servicesList: { width: '100%', gap: 12, marginTop: 16 },
    serviceItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 12, padding: 16 },
    serviceName: { flex: 1 },
    serviceButton: { paddingVertical: 8, paddingHorizontal: 12 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.divider },
    dotActive: { backgroundColor: theme.primary, width: 24 },
    buttonRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 32, paddingBottom: 32 },
    nextButton: { flex: 1 },
  });
}
