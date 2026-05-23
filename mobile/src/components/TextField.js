import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../../theme';

/** Labelled text input styled for the dark theme, with a focus accent.
 *  When `secureTextEntry` is set, renders an eye toggle that flips visibility. */
export default function TextField({ label, style, multiline, secureTextEntry, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecure = !!secureTextEntry;
  const hideText = isSecure && !revealed;

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[
            styles.input,
            multiline && styles.multiline,
            focused && styles.inputFocused,
            isSecure && styles.inputWithToggle,
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={multiline}
          secureTextEntry={hideText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {isSecure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off' : 'eye'}
              size={20}
              color={focused ? colors.primary : colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
  },
  inputWithToggle: { paddingRight: 44 },
  inputFocused: { borderColor: colors.primary },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md },
  toggle: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
