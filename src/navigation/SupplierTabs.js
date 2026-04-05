import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, Platform } from 'react-native';
import { C } from '../lib/colors';

import SupplierHomeScreen from '../screens/supplier/SupplierHomeScreen';
import SupplierRequestsScreen from '../screens/supplier/SupplierRequestsScreen';
import SupplierProductsScreen from '../screens/supplier/SupplierProductsScreen';
import SupplierInboxScreen from '../screens/supplier/SupplierInboxScreen';
import SupplierAccountScreen from '../screens/supplier/SupplierAccountScreen';
import ChatScreen from '../screens/buyer/ChatScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const STACK_OPTS = { headerShown: false };

function SupplierHomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="SupplierDash" component={SupplierHomeScreen} />
    </Stack.Navigator>
  );
}

function SupplierInboxStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="SupplierInboxList" component={SupplierInboxScreen} />
      <Stack.Screen name="SupplierChat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICON  = { SHome: '⌂', SRequests: '◫', SProducts: '◈', SInbox: '◎', SAccount: '⊙' };
const TAB_LABEL = { SHome: 'الرئيسية', SRequests: 'الطلبات', SProducts: 'منتجاتي', SInbox: 'رسائل', SAccount: 'حسابي' };

function tabIcon(name, focused) {
  return (
    <Text style={{ fontSize: 20, color: focused ? C.accent : C.textDisabled }}>
      {TAB_ICON[name]}
    </Text>
  );
}

export default function SupplierTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => tabIcon(route.name, focused),
        tabBarLabel: ({ focused }) => (
          <Text style={{
            fontSize: 10,
            color: focused ? C.accent : C.textDisabled,
            fontWeight: focused ? '600' : '400',
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          }}>
            {TAB_LABEL[route.name]}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: C.bgRaised,
          borderTopColor: C.borderDefault,
          borderTopWidth: 1,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 80 : 62,
        },
      })}
    >
      <Tab.Screen name="SHome" component={SupplierHomeStack} />
      <Tab.Screen name="SRequests" component={SupplierRequestsScreen} />
      <Tab.Screen name="SProducts" component={SupplierProductsScreen} />
      <Tab.Screen name="SInbox" component={SupplierInboxStack} />
      <Tab.Screen name="SAccount" component={SupplierAccountScreen} />
    </Tab.Navigator>
  );
}
