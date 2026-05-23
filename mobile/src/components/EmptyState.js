import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppButton from './AppButton';
import { colors, radius, spacing } from '../../theme';

export default function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg, minWidth: 200 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
    lineHeight: 20,
  },
});
