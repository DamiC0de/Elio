/**
 * TranscriptOverlay — Displays speech transcription with role labels and typing animation
 * US-027: Improved transcript display with streaming support
 * US-028: Long-press to copy, haptic feedback, accessibility
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { TypingText } from './TypingText';

interface TranscriptOverlayProps {
  text: string | null;
  role?: 'user' | 'assistant';
  isStreaming?: boolean;
}

export function TranscriptOverlay({ 
  text, 
  role = 'user',
  isStreaming = false,
}: TranscriptOverlayProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const isUser = role === 'user';
  const roleLabel = isUser ? 'Toi' : 'Diva';

  useEffect(() => {
    if (text) {
      opacity.setValue(0);
      Animated.timing(opacity, { 
        toValue: 1, 
        duration: 250, 
        useNativeDriver: true 
      }).start();
    } else {
      Animated.timing(opacity, { 
        toValue: 0, 
        duration: 200, 
        useNativeDriver: true 
      }).start();
    }
  }, [text, role]);

  // Auto-scroll to bottom when text changes
  useEffect(() => {
    if (text && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [text]);

  /**
   * US-028: Copy text to clipboard with haptic feedback
   */
  const handleLongPress = async () => {
    if (text && role === 'assistant') {
      await Clipboard.setStringAsync(text);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copié !', 'Le texte a été copié dans le presse-papier.');
    }
  };

  if (!text) return null;

  const content = (
    <>
      {/* Role label */}
      <View style={styles.labelContainer}>
        <Text style={[
          styles.label, 
          { color: isUser ? theme.primary : theme.teal }
        ]}>
          {roleLabel}
        </Text>
      </View>
      
      {/* Transcript content with scroll */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {isStreaming && !isUser ? (
          <TypingText 
            text={text}
            style={[styles.text, { color: theme.text }]}
            speed={15}
            showCursor={true}
          />
        ) : (
          <Text style={[styles.text, { color: theme.text }]}>
            {text}
          </Text>
        )}
      </ScrollView>
    </>
  );

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity,
          backgroundColor: isUser ? theme.primarySoft : theme.tealSoft,
          borderColor: isUser ? theme.primary : theme.teal,
        }
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        isUser 
          ? `Vous avez dit: ${text}` 
          : `Réponse de Diva: ${text}`
      }
      accessibilityHint={!isUser ? 'Appui long pour copier' : undefined}
    >
      {!isUser ? (
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={500}
          style={styles.pressable}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 16,
    maxHeight: 160,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  pressable: {
    flex: 1,
  },
  labelContainer: {
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  scrollView: {
    maxHeight: 110,
  },
  scrollContent: {
    flexGrow: 1,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
});
