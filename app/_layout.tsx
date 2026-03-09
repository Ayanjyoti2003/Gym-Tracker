import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import LoadingScreen from '@/components/LoadingScreen';

export const unstable_settings = {
  anchor: '(tabs)',
};

import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isNewSignIn, clearNewSignIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  // State to hold minimum delay before hiding the LoadingScreen
  const [isReady, setIsReady] = useState(false);
  // Track if we've successfully hidden the native splash screen
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    // Hide the native splash screen safely
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      } catch (error) {
        setSplashHidden(true);
      }
    };
    
    // Slight timeout ensures React has actually painted the LoadingScreen below
    setTimeout(hideSplash, 100);
    
    // Enforce a minimum display time for the premium LoadingScreen
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 4500); // 4.5 seconds delay to allow reading the quote
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Wait for both the auth resolution AND our minimum delay to finish
    if (loading || !isReady) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Redirect to login if user is not authenticated and not already on the login page
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to tabs if user is authenticated and tries to access login page
      if (isNewSignIn) {
        router.replace({ pathname: '/(tabs)/profile', params: { newSignIn: 'true' } });
        clearNewSignIn();
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, isReady, segments, router, isNewSignIn, clearNewSignIn]);

  if (loading || !isReady) {
    // Our custom premium Loading Screen animation
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </ThemeProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}
