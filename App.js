import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';

// ── Force Update ──────────────────────────────────────────────────────────────
import { forceUpdateCheck } from './src/lib/force-update';
forceUpdateCheck(); // يجبر تغيير bundle

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
