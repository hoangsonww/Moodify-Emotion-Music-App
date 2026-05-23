// Tactile feedback wrapper. Silently no-ops if expo-haptics isn't present
// or on platforms that don't support it.

import * as Haptics from 'expo-haptics';

const safe = (fn) => {
  try {
    fn();
  } catch {
    // platform unsupported / module missing
  }
};

export const tapLight = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const tapMedium = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const tapHeavy = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
export const select = () => safe(() => Haptics.selectionAsync());
