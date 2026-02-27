/**
 * EL-014 — Reusable Settings Row Components
 */
import React from 'react';
import { View, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { colors } from '../constants/colors';

interface SettingRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export function SettingRow({ label, value, onPress, rightElement }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {value && <Text style={styles.value}>{value}</Text>}
        {rightElement}
        {onPress && <Text style={styles.chevron}>›</Text>}
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
  return (
    <View style={styles.row}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: colors.primary, false: '#ddd' }}
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
  return (
    <View style={styles.selectContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, selected === opt.value && styles.optionSelected]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.optionText, selected === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function SettingSectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, color: '#1a1a1a' },
  labelContainer: { flex: 1 },
  value: { fontSize: 16, color: '#888' },
  chevron: { fontSize: 20, color: '#ccc' },
  description: { fontSize: 13, color: '#888', marginTop: 2 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectContainer: { paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5e5' },
  optionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  option: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#f0f0f0' },
  optionSelected: { backgroundColor: colors.primary },
  optionText: { fontSize: 14, color: '#666' },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
});
