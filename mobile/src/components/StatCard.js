import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../../theme';

export default function StatCard({ icon, label, value, tint = colors.primary, tintSoft = colors.primarySoft }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={[styles.value, { color: tint }]}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
});
