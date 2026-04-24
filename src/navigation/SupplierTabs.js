import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';
import { getLang } from '../lib/lang';

import SupplierHomeScreen from '../screens/supplier/SupplierHomeScreen';
import FAQScreen          from '../screens/shared/FAQScreen';
import FAQTradersScreen   from '../screens/shared/FAQTradersScreen';
import FAQSuppliersScreen from '../screens/shared/FAQSuppliersScreen';
import TermsScreen        from '../screens/shared/TermsScreen';
import ContactScreen      from '../screens/shared/ContactScreen';
import SupportScreen      from '../screens/shared/SupportScreen';
import SupplierRequestsScreen from '../screens/supplier/SupplierRequestsScreen';
import SupplierManagedMatchesScreen from '../screens/supplier/SupplierManagedMatchesScreen';
import SupplierProductsScreen from '../screens/supplier/SupplierProductsScreen';
import SupplierOffersScreen from '../screens/supplier/SupplierOffersScreen';
import SupplierInboxScreen from '../screens/supplier/SupplierInboxScreen';
import SupplierAccountScreen from '../screens/supplier/SupplierAccountScreen';
import ChatScreen from '../screens/buyer/ChatScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const STACK_OPTS = { headerShown: false };

// ── Tab labels in all 3 languages ──────────────────────────────────────────
// Tab-bar labels are intentionally terse so all 7 fit / scroll cleanly. The
// per-screen headers in each screen carry the fuller copy (e.g. SupplierManaged
// shows "الطلبات المطابقة" at the top of the screen itself).
const TAB_LABELS = {
  ar: {
    SHome: 'الرئيسية',
    SRequests: 'الطلبات',
    SManaged: 'المطابقة',
    SProducts: 'منتجاتي',
    SOffers: 'عروضي',
    SInbox: 'رسائل',
    SAccount: 'حسابي',
  },
  en: {
    SHome: 'Home',
    SRequests: 'Requests',
    SManaged: 'Matched',
    SProducts: 'Products',
    SOffers: 'My Offers',
    SInbox: 'Inbox',
    SAccount: 'Account',
  },
  zh: {
    SHome: '首页',
    SRequests: '询盘',
    SManaged: '匹配',
    SProducts: '产品',
    SOffers: '我的报价',
    SInbox: '消息',
    SAccount: '账户',
  },
};

// ── Stacks that need child screens ─────────────────────────────────────────
function SupplierHomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="SupplierDash"  component={SupplierHomeScreen} />
      <Stack.Screen name="FAQ"           component={FAQScreen} />
      <Stack.Screen name="FAQTraders"    component={FAQTradersScreen} />
      <Stack.Screen name="FAQSuppliers"  component={FAQSuppliersScreen} />
      <Stack.Screen name="Terms"         component={TermsScreen} />
      <Stack.Screen name="Contact"       component={ContactScreen} />
      <Stack.Screen name="Support"       component={SupportScreen} />
    </Stack.Navigator>
  );
}

function SupplierInboxStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="SupplierInboxList" component={SupplierInboxScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

// ── Custom horizontally-scrollable tab bar ──────────────────────────────────
function SupplierTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const lang = getLang();
  const labels = TAB_LABELS[lang] || TAB_LABELS.ar;

  return (
    <View style={[
      tb.container,
      { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 4 },
    ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tb.scrollContent}
        bounces
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = labels[route.name] || route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={tb.tab}
            >
              <Text style={[tb.label, isFocused && tb.labelActive]}>
                {label}
              </Text>
              {isFocused && <View style={tb.indicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const tb = StyleSheet.create({
  container: {
    backgroundColor: C.bgRaised,
    borderTopWidth: 1,
    borderTopColor: C.borderDefault,
    paddingTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    position: 'relative',
    minWidth: 56,
  },
  label: {
    fontSize: 12,
    fontFamily: F.arSemi,
    color: C.textDisabled,
  },
  labelActive: {
    color: C.textPrimary,
  },
  indicator: {
    position: 'absolute',
    bottom: -4,
    left: '25%',
    right: '25%',
    height: 2,
    borderRadius: 1,
    backgroundColor: C.textPrimary,
  },
});

// ── Navigator ───────────────────────────────────────────────────────────────
export default function SupplierTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <SupplierTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="SHome" component={SupplierHomeStack} />
      <Tab.Screen name="SRequests" component={SupplierRequestsScreen} />
      <Tab.Screen name="SManaged" component={SupplierManagedMatchesScreen} />
      <Tab.Screen name="SProducts" component={SupplierProductsScreen} />
      <Tab.Screen name="SOffers" component={SupplierOffersScreen} />
      <Tab.Screen name="SInbox" component={SupplierInboxStack} />
      <Tab.Screen name="SAccount" component={SupplierAccountScreen} />
    </Tab.Navigator>
  );
}
