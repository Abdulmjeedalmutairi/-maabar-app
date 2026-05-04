import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { hydrateDisplayCurrencyState } from '../lib/displayCurrency';
import { getLang, loadLang } from '../lib/lang';
import SplashScreen from '../screens/SplashScreen';
import AuthStack from './AuthStack';
import BuyerTabs from './BuyerTabs';
import SupplierTabs from './SupplierTabs';
import SupplierOnboardingScreen from '../screens/supplier/SupplierOnboardingScreen';

// Navigation ref so the post-approval onboarding overlay can route to a
// supplier tab (SProducts / SRequests) once it flips onboarding_completed=true.
const navRef = createNavigationContainerRef();

// Approved-status set the gate honors. Must match
// web/src/lib/supplierOnboarding.js LEGACY_VERIFIED_STATUSES + 'verified'.
const APPROVED_STATUSES = ['verified', 'approved', 'active'];

const Stack = createNativeStackNavigator();
const LAUNCHED_KEY = 'maabar_hasLaunched';

export default function RootNavigator() {
  const [splashDone, setSplashDone]   = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);

  useEffect(() => {
    // Hydrate persisted language, the launched-flag, and the Supabase session
    // in parallel during boot. loadLang() runs BEFORE any screen mounts so
    // every screen can call getLang() and see the user's last choice.
    Promise.all([
      loadLang(),
      SecureStore.getItemAsync(LAUNCHED_KEY),
      supabase.auth.getSession(),
    ]).then(([, launched, { data: { session: s } }]) => {
      setHasLaunched(!!launched);
      setSession(s);
      if (s) loadProfile(s.user.id);
      else hydrateDisplayCurrencyState({ profile: null, lang: getLang() });
    });

    // Keep session in sync while the app is open
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s) loadProfile(s.user.id);
        else {
          setProfile(null);
          hydrateDisplayCurrencyState({ profile: null, lang: getLang() });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, status, company_name, preferred_display_currency, onboarding_completed, maabar_supplier_id')
      .eq('id', userId)
      .single();
    setProfile(data);
    hydrateDisplayCurrencyState({ profile: data, lang: getLang() });
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

  // Always start at the language picker for unauthenticated visitors so the
  // user re-confirms their language each launch. Persisted lang from
  // SecureStore (loadLang) still pre-applies to the picker's text.
  const authInitialRoute = 'Language';

  // Post-approval onboarding gate — mirrors web DashboardSupplier.jsx:348
  // (showOnboardingSequence). Renders the overlay when the supplier has been
  // approved but hasn't yet flipped onboarding_completed=true.
  const showSupplierOnboarding = (
    isLoggedIn
    && isSupplier
    && profile
    && APPROVED_STATUSES.includes(String(profile.status || '').toLowerCase())
    && profile.onboarding_completed !== true
  );

  function handleNavigateToSupplierTab(tabName) {
    if (navRef.isReady()) {
      navRef.navigate('SupplierApp', { screen: tabName });
    }
  }

  function handleOnboardingComplete() {
    // Re-fetch profile so onboarding_completed=true persists across cold reloads.
    if (session?.user?.id) loadProfile(session.user.id);
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navRef}>
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

      {/* Post-approval onboarding overlay — full-screen modal above SupplierTabs.
          Matches web's "no escape until completed" UX (BackHandler is blocked
          inside the overlay component). */}
      {showSupplierOnboarding && (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000,
            elevation: 1000,
          }}
        >
          <SupplierOnboardingScreen
            user={session.user}
            profile={profile}
            setProfile={setProfile}
            onComplete={handleOnboardingComplete}
            onNavigateToTab={handleNavigateToSupplierTab}
          />
        </View>
      )}
    </View>
  );
}
