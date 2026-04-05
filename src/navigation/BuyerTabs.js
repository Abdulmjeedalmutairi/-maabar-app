import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, Platform } from 'react-native';
import { C } from '../lib/colors';

import DashboardScreen from '../screens/buyer/DashboardScreen';
import RequestsScreen from '../screens/buyer/RequestsScreen';
import OffersScreen from '../screens/buyer/OffersScreen';
import InboxScreen from '../screens/buyer/InboxScreen';
import ChatScreen from '../screens/buyer/ChatScreen';
import AccountScreen from '../screens/buyer/AccountScreen';
import ProductsScreen from '../screens/shared/ProductsScreen';
import ProductDetailScreen from '../screens/shared/ProductDetailScreen';
import SuppliersScreen from '../screens/shared/SuppliersScreen';
import SupplierProfileScreen from '../screens/shared/SupplierProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const STACK_OPTS = { headerShown: false };

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="BuyerHome" component={DashboardScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Suppliers" component={SuppliersScreen} />
      <Stack.Screen name="SupplierProfile" component={SupplierProfileScreen} />
    </Stack.Navigator>
  );
}

function RequestsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="RequestsList" component={RequestsScreen} />
      <Stack.Screen name="Offers" component={OffersScreen} />
    </Stack.Navigator>
  );
}

function InboxStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="InboxList" component={InboxScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICON = { Home: '⌂', Requests: '◫', Inbox: '◎', Account: '⊙' };
const TAB_LABEL = { Home: 'الرئيسية', Requests: 'طلباتي', Inbox: 'رسائل', Account: 'حسابي' };

function tabIcon(name, focused) {
  return (
    <Text style={{ fontSize: 20, color: focused ? C.accent : C.textDisabled }}>
      {TAB_ICON[name]}
    </Text>
  );
}

export default function BuyerTabs() {
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
        tabBarBackground: () => null,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Requests" component={RequestsStack} />
      <Tab.Screen name="Inbox" component={InboxStack} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
