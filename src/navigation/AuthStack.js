import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupBuyerScreen from '../screens/auth/SignupBuyerScreen';
import SignupSupplierScreen from '../screens/auth/SignupSupplierScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignupBuyer" component={SignupBuyerScreen} />
      <Stack.Screen name="SignupSupplier" component={SignupSupplierScreen} />
    </Stack.Navigator>
  );
}
