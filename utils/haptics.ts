import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'medium') => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.vibrate) {
        const ms = type === 'light' ? 15 : type === 'medium' ? 30 : type === 'heavy' ? 50 : type === 'success' ? 40 : 35;
        window.navigator.vibrate(ms);
      }
    } else {
      if (type === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else if (type === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else if (type === 'heavy') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } else if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    }
  } catch (e) {
    // Ignore haptic errors on unsupported devices
  }
};
