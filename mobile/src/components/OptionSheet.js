// A bottom-sheet single-choice picker with a blurred backdrop.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { select } from '../util/haptics';
import { colors, radius, shadows, spacing } from '../../theme';

export default function OptionSheet({ visible, title, options, selectedKey, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={[styles.sheet, shadows.md]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const active = option.key === selectedKey;
              return (
                <Pressable
                  key={String(option.key)}
                  onPress={() => {
                    select();
                    onSelect(option.key);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.rowActive,
                    pressed && styles.rowPressed,
                  ]}
                >
                  {option.icon ? (
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                      style={{ marginRight: 12 }}
                    />
                  ) : null}
                  <Text style={[styles.rowText, active && styles.rowTextActive]}>
                    {option.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderHi,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: spacing.md },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowActive: {},
  rowPressed: { opacity: 0.5 },
  rowText: { flex: 1, color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  rowTextActive: { color: colors.text, fontWeight: '800' },
});
