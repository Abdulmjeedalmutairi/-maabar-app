import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { C } from '../lib/colors';
import AuthStack from './AuthStack';
import BuyerTabs from './BuyerTabs';
import SupplierTabs from './SupplierTabs';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) loadProfile(session.user.id);
        else { setProfile(null); setLoading(false); }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, status, company_name')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  const isSupplier = profile?.role === 'supplier';
  const isLoggedIn = !!session && !!profile;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : isSupplier ? (
          <Stack.Screen name="SupplierApp" component={SupplierTabs} />
        ) : (
          <Stack.Screen name="BuyerApp" component={BuyerTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
