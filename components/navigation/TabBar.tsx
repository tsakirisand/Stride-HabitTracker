import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, LayoutChangeEvent } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 250,
  mass: 0.5,
};

// Component for individual Tab Icons with scale animation and Glow Effect
function TabIcon({ 
  iconName, 
  isFocused, 
  isStats 
}: { 
  iconName: keyof typeof Ionicons.glyphMap; 
  isFocused: boolean;
  isStats?: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.15 : 1, SPRING_CONFIG);
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Glow effect styles
  const glowStyle = isFocused ? {
    shadowColor: '#4DA8DA',
    shadowOffset: { width: isStats ? -2 : 0, height: 0 }, // 2px left offset for stats
    shadowOpacity: 0.8,
    shadowRadius: 12,
  } : {};

  return (
    <Animated.View style={[animatedStyle, glowStyle]}>
      <Ionicons 
        name={iconName} 
        size={24} 
        color={isFocused ? '#4DA8DA' : '#8A8A8E'} 
      />
    </Animated.View>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  const handleLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts(prev => ({
      ...prev,
      [index]: { x, width }
    }));
  }, []);

  useEffect(() => {
    const activeLayout = layouts[state.index];
    if (activeLayout) {
      pillX.value = withSpring(activeLayout.x, SPRING_CONFIG);
      pillWidth.value = withSpring(activeLayout.width, SPRING_CONFIG);
      pillOpacity.value = withSpring(1, SPRING_CONFIG);
    }
  }, [state.index, layouts]);

  const animatedPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
    opacity: pillOpacity.value,
  }));

  return (
    <View style={[
      styles.container, 
      { bottom: 10 + insets.bottom }
    ]}>
      <Animated.View style={[styles.slidingPill, animatedPillStyle]} />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isStats = route.name === 'explore';

        const label = options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
            ? options.title
            : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(route.name, route.params);
          }
        };

        let iconName: keyof typeof Ionicons.glyphMap;
        if (route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
        else if (route.name === 'explore') iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
        else if (route.name === 'settings') iconName = isFocused ? 'settings' : 'settings-outline';
        else iconName = isFocused ? 'cube' : 'cube-outline';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            onLayout={(event) => handleLayout(index, event)}
            style={styles.tabItem}
          >
            <TabIcon iconName={iconName} isFocused={isFocused} isStats={isStats} />
            <ThemedText style={[
              styles.label,
              { color: isFocused ? '#4DA8DA' : '#8A8A8E' }
            ]}>
              {label as string}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'absolute',
    left: 40,
    right: 40,
    height: 70, // Increased to 70 for labels
    borderRadius: 35,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    // Refined Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  slidingPill: {
    position: 'absolute',
    height: 54, // Matches taller container
    borderRadius: 27,
    backgroundColor: '#2C2C2E',
    zIndex: 0,
    left: 0,
  },
  tabItem: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6, // Shift items down slightly
    zIndex: 1,
    borderRadius: 27,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -4, 
  },
});


