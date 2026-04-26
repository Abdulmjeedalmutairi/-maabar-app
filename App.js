import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Cairo_300Light,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';
import { C } from './src/lib/colors';

// ── Force Update ──────────────────────────────────────────────────────────────
import { forceUpdateCheck } from './src/lib/force-update';
forceUpdateCheck();

export default function App() {
  const [fontsLoaded] = useFonts({
    Cairo_300Light,
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
