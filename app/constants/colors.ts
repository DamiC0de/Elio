export const Colors = {
  primary: '#FF8C42',      // Orange solaire
  secondary: '#2A7B8B',    // Deep Teal
  background: '#F0EEE9',   // Cloud Dancer
  accent: '#7ECFB3',       // Synthesized Mint
  text: '#1A1A2E',         // Dark
  textLight: '#6B7280',    // Gray
  white: '#FFFFFF',
  error: '#DC2626',
  success: '#16A34A',
  warning: '#F59E0B',
  border: '#E5E7EB',
  card: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.08)',
} as const;

export type ColorKey = keyof typeof Colors;
