import React from 'react';
import { Text as RNText, StyleSheet, type TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

type TextVariant = 'hero' | 'heading' | 'subheading' | 'body' | 'caption';

interface TextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: TextStyle;
}

export function Text({ children, variant = 'body', color, style }: TextProps) {
  return (
    <RNText style={[variantStyles[variant], color ? { color } : undefined, style]}>
      {children}
    </RNText>
  );
}

const variantStyles = StyleSheet.create({
  hero: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    lineHeight: Typography.sizes.hero * Typography.lineHeights.tight,
  },
  heading: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    lineHeight: Typography.sizes.xl * Typography.lineHeights.tight,
  },
  subheading: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  body: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.regular,
    color: Colors.text,
    lineHeight: Typography.sizes.md * Typography.lineHeights.normal,
  },
  caption: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.textLight,
  },
});
