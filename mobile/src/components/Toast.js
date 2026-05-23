// Lightweight in-app toast system. Drop-in replacement for Alert for
// non-blocking feedback. Render <ToastHost /> once near the root and call
// useToast().show({ ... }) from anywhere.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, shadows, spacing } from '../../theme';

const ICONS = {
  success: { name: 'checkmark-circle', color: colors.success, bg: colors.successSoft },
  error: { name: 'alert-circle', color: colors.danger, bg: colors.dangerSoft },
  info: { name: 'information-circle', color: colors.primary, bg: colors.primarySoft },
  warning: { name: 'warning', color: colors.warning, bg: 'rgba(251, 191, 36, 0.18)' },
};

const ToastContext = createContext({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((next) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({
      type: 'info',
      duration: 3200,
      ...next,
      id: Date.now() + Math.random(),
    });
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastHost toast={toast} onHide={dismiss} timerRef={timerRef} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toast, onHide, timerRef }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return undefined;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(onHide);
    }, toast.duration || 3200);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [toast?.id]);

  if (!toast) return null;
  const icon = ICONS[toast.type] || ICONS.info;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.host}>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.wrap, { transform: [{ translateY }], opacity }]}
      >
        <Pressable onPress={onHide} style={[styles.card, shadows.md]}>
          <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={20} color={icon.color} />
          </View>
          <View style={styles.body}>
            {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
            {toast.message ? (
              <Text style={styles.message} numberOfLines={3}>
                {toast.message}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  message: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
