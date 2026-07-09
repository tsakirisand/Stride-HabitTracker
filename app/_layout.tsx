import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { HabitsProvider, useHabitsContext } from '@/context/HabitsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { user, isAuthReady } = useHabitsContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not authenticated → redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Authenticated → redirect to main app
      router.replace('/(tabs)');
    }
  }, [user, isAuthReady, segments]);

  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4DA8DA" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen name="premium" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <HabitsProvider>
        <RootNavigator />
      </HabitsProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
