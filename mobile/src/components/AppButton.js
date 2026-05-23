import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { tapLight } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing } from '../../theme';

/** Primary (brand gradient), ghost, danger or success button with a
 *  loading state, haptic feedback, and a spring press scale. */
export default function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  iconPosition = 'left',
  haptic = true,
  size = 'md',
  style,
}) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (haptic && !isDisabled) tapLight();
    onPress && onPress();
  };

  const animateTo = (toValue) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, friction: 5, tension: 220 }).start();

  const iconColor = variant === 'ghost' ? colors.text : '#fff';

  const inner = loading ? (
    <ActivityIndicator color={iconColor} />
  ) : (
    <>
      {icon && iconPosition === 'left' ? (
        <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={iconColor} style={styles.iconLeft} />
      ) : null}
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.labelSm,
          variant === 'ghost' && styles.labelGhost,
        ]}
      >
        {title}
      </Text>
      {icon && iconPosition === 'right' ? (
        <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={iconColor} style={styles.iconRight} />
      ) : null}
    </>
  );

  const sizeStyle = size === 'sm' ? styles.baseSm : styles.base;
  const wrapAnim = { transform: [{ scale }] };

  if (variant === 'primary') {
    return (
      <Animated.View style={[wrapAnim, style]}>
        <Pressable
          onPress={press}
          onPressIn={() => animateTo(0.97)}
          onPressOut={() => animateTo(1)}
          disabled={isDisabled}
          style={[styles.shadow, isDisabled && styles.disabled]}
        >
          <LinearGradient
            colors={gradient.colors}
            start={gradient.start}
            end={gradient.end}
            style={sizeStyle}
          >
            {inner}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[wrapAnim, style]}>
      <Pressable
        onPress={press}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        disabled={isDisabled}
        style={[
          sizeStyle,
          variant === 'ghost' && styles.ghost,
          variant === 'danger' && styles.danger,
          variant === 'success' && styles.success,
          isDisabled && styles.disabled,
        ]}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  baseSm: {
    height: 40,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.success },
  shadow: { ...shadows.glow, borderRadius: radius.md },
  disabled: { opacity: 0.45 },
  label: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  labelSm: { fontSize: 13, fontWeight: '700' },
  labelGhost: { color: colors.text },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
