/**
 * EL-014 — Reusable Settings Row Components (dark mode)
 */
import React from 'react';
import { View, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { useTheme } from '../constants/theme';

interface SettingRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export function SettingRow({ label, value, onPress, rightElement }: SettingRowProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: theme.card, borderBottomColor: theme.border }]} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.right}>
        {value && <Text style={[styles.value, { color: theme.textSecondary }]}>{value}</Text>}
        {rightElement}
        {onPress && <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

interface SettingToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}

export function SettingToggle({ label, description, value, onToggle }: SettingToggleProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {description && <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: theme.primary, false: theme.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

interface SettingSelectProps {
  label: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (val: string) => void;
}

export function SettingSelect({ label, options, selected, onSelect }: SettingSelectProps) {
  const theme = useTheme();
  return (
    <View style={[styles.selectContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, { backgroundColor: theme.inputBg }, selected === opt.value && { backgroundColor: theme.primary }]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.optionText, { color: theme.textSecondary }, selected === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function SettingSectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16 },
  labelContainer: { flex: 1 },
  value: { fontSize: 16 },
  chevron: { fontSize: 20 },
  description: { fontSize: 13, marginTop: 2 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  selectContainer: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  optionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  option: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  optionText: { fontSize: 14 },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
});
