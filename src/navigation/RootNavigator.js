import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import SplashScreen from '../screens/SplashScreen';
import AuthStack from './AuthStack';
import BuyerTabs from './BuyerTabs';
import SupplierTabs from './SupplierTabs';

const Stack = createNativeStackNavigator();
const LAUNCHED_KEY = 'maabar_hasLaunched';

export default function RootNavigator() {
  const [splashDone, setSplashDone]   = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);

  useEffect(() => {
    // Load AsyncStorage flag and initial Supabase session in parallel
    Promise.all([
      SecureStore.getItemAsync(LAUNCHED_KEY),
      supabase.auth.getSession(),
    ]).then(([launched, { data: { session: s } }]) => {
      setHasLaunched(!!launched);
      setSession(s);
      if (s) loadProfile(s.user.id);
    });

    // Keep session in sync while the app is open
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s) loadProfile(s.user.id);
        else setProfile(null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, status, company_name')
      .eq('id', userId)
      .single();
    setProfile(data);
  }

  async function handleSplashDone() {
    if (!hasLaunched) {
      await SecureStore.setItemAsync(LAUNCHED_KEY, 'true');
      setHasLaunched(true);
    }
    setSplashDone(true);
  }

  const isLoggedIn  = !!session && !!profile;
  const isSupplier  = profile?.role === 'supplier';

  // On return visits without a session, drop the user at TraderHome
  // (they've already completed Language + Role onboarding).
  const authInitialRoute = hasLaunched ? 'TraderHome' : 'Language';

  return (
    <NavigationContainer>
      {/* animation:'none' only affects root-level screen transitions; inner
          stacks keep their own animations. The Splash fade-out handles the
          visual transition, so no cross-fade is needed here. */}
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
        {!splashDone ? (
          <Stack.Screen name="Splash">
            {() => <SplashScreen onDone={handleSplashDone} />}
          </Stack.Screen>
        ) : isLoggedIn && isSupplier ? (
          <Stack.Screen name="SupplierApp" component={SupplierTabs} />
        ) : isLoggedIn ? (
          <Stack.Screen name="BuyerApp" component={BuyerTabs} />
        ) : (
          <Stack.Screen name="Auth">
            {() => <AuthStack initialRoute={authInitialRoute} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
