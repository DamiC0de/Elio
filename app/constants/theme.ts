/**
 * Elio Design System — 2026 Trends
 * 
 * Approach: "Mermaidcore meets Cloud Dancer"
 * - Light: Cloud Dancer whites + soft teal accents
 * - Dark: Deep navy/charcoal + iridescent violet-teal gradient accent
 * - Both: Warm naturals, no harsh contrasts
 */
import { useColorScheme } from 'react-native';

// Shared accent palette
const accent = {
  primary: '#6366F1',       // Indigo — modern, trustworthy
  primaryLight: '#818CF8',
  primarySoft: 'rgba(99, 102, 241, 0.12)',
  teal: '#2DD4BF',          // Teal — mermaidcore iridescent
  tealSoft: 'rgba(45, 212, 191, 0.12)',
  coral: '#F472B6',         // Soft pink — dopamine pop
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
};

// Orb state colors (US-024, US-025)
const orbColors = {
  orbIdle: '#8B5CF6',       // Violet — ready, waiting
  orbListening: '#3B82F6',  // Blue — active listening
  orbProcessing: '#06B6D4', // Cyan — thinking/processing
  orbSpeaking: '#10B981',   // Green — speaking response
  orbError: '#EF4444',      // Red — error state
};

export const lightTheme = {
  ...accent,
  ...orbColors,
  // Backgrounds
  bg: '#FAFAF9',            // Cloud Dancer warm white
  bgSecondary: '#F5F3EF',   // Slightly warm
  bgTertiary: '#EDEBE6',
  
  // Surfaces
  card: '#FFFFFF',
  cardBorder: '#E8E5DE',
  cardElevated: '#FFFFFF',
  
  // Text
  text: '#1A1A2E',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  
  // Input
  inputBg: '#FFFFFF',
  inputBorder: '#E2DFD8',
  inputFocus: accent.primary,
  
  // Orb background
  orbBg: '#F0EDE6',
  
  // Misc
  shadow: 'rgba(0, 0, 0, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  divider: '#E8E5DE',
  statusBar: 'dark' as const,
};

export const darkTheme = {
  ...accent,
  ...orbColors,
  // Backgrounds
  bg: '#0C0C14',            // Deep space navy
  bgSecondary: '#12121E',
  bgTertiary: '#1A1A2A',
  
  // Surfaces
  card: '#16162A',
  cardBorder: '#252540',
  cardElevated: '#1E1E36',
  
  // Text
  text: '#F1F0EE',          // Cloud Dancer tinted
  textSecondary: '#9CA3AF',
  textMuted: '#5B6078',
  textInverse: '#0C0C14',
  
  // Input
  inputBg: '#16162A',
  inputBorder: '#2A2A44',
  inputFocus: accent.primaryLight,
  
  // Orb background
  orbBg: '#1A1A2E',
  
  // Misc
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  divider: '#252540',
  statusBar: 'light' as const,
};

export type Theme = typeof lightTheme;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

// Keep backward compat
export const Colors = lightTheme;
export const colors = Colors;
