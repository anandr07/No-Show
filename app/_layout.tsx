import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfair,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInter,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { GameProvider } from '@/context/GameContext';
import { AuthProvider } from '@/context/AuthContext';
import { RoomProvider } from '@/context/RoomContext';
import Colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="setup" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="game" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="results" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="howtoplay" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="online-setup" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="room-entry" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="room-lobby" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [playfairLoaded, playfairError] = usePlayfair({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });
  const [interLoaded, interError] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const fontsLoaded = playfairLoaded && interLoaded;
  const fontError = playfairError || interError;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <GameProvider>
                <RoomProvider>
                  <RootLayoutNav />
                </RoomProvider>
              </GameProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
