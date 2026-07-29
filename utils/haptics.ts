import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticType = 'light' | 'medium' | 'heavy' | 'shock' | 'success' | 'warning';

export const triggerHaptic = (type: HapticType = 'medium') => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.vibrate) {
        let pattern: number | number[] = 50;
        if (type === 'light') pattern = 30;
        else if (type === 'medium') pattern = 60;
        else if (type === 'heavy') pattern = 90;
        else if (type === 'shock') pattern = [80, 40, 80]; // Punchy double shock vibration pulse
        else if (type === 'success') pattern = [40, 30, 90];
        else if (type === 'warning') pattern = [90, 40, 90];

        window.navigator.vibrate(pattern);
      }
    } else {
      if (type === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else if (type === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else if (type === 'heavy' || type === 'shock') {
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
