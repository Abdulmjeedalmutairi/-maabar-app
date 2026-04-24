import React, { useState, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Text, Platform, View, Modal, TouchableOpacity,
  TouchableWithoutFeedback, StyleSheet,
} from 'react-native';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';

import DashboardScreen      from '../screens/buyer/DashboardScreen';
import RequestsScreen       from '../screens/buyer/RequestsScreen';
import NewRequestScreen     from '../screens/buyer/NewRequestScreen';
import OffersScreen         from '../screens/buyer/OffersScreen';
import AllOffersScreen      from '../screens/buyer/AllOffersScreen';
import InboxScreen          from '../screens/buyer/InboxScreen';
import ChatScreen           from '../screens/buyer/ChatScreen';
import AccountScreen        from '../screens/buyer/AccountScreen';
import ProductsScreen       from '../screens/shared/ProductsScreen';
import ProductDetailScreen  from '../screens/shared/ProductDetailScreen';
import SuppliersScreen      from '../screens/shared/SuppliersScreen';
import SupplierProfileScreen from '../screens/shared/SupplierProfileScreen';
import IdeaToProductScreen  from '../screens/buyer/IdeaToProductScreen';
import CheckoutScreen       from '../screens/buyer/CheckoutScreen';
import PaymentScreen        from '../screens/buyer/PaymentScreen';
import ProductInquiriesScreen from '../screens/buyer/ProductInquiriesScreen';
import SamplesScreen        from '../screens/buyer/SamplesScreen';
import ManagedRequestScreen from '../screens/buyer/ManagedRequestScreen';
import FAQScreen            from '../screens/shared/FAQScreen';
import FAQTradersScreen     from '../screens/shared/FAQTradersScreen';
import FAQSuppliersScreen   from '../screens/shared/FAQSuppliersScreen';
import TermsScreen          from '../screens/shared/TermsScreen';
import ContactScreen        from '../screens/shared/ContactScreen';
import SupportScreen        from '../screens/shared/SupportScreen';
import WebViewScreen        from '../screens/shared/WebViewScreen';
import CalcToolScreen       from '../screens/buyer/CalcToolScreen';
import OrderDetailScreen    from '../screens/buyer/OrderDetailScreen';
import AIHub                from '../components/AIHub';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const STACK_OPTS = { headerShown: false };

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="BuyerHome"       component={DashboardScreen} />
      <Stack.Screen name="NewRequestStack"  component={NewRequestScreen} />
      <Stack.Screen name="Products"        component={ProductsScreen} />
      <Stack.Screen name="ProductDetail"   component={ProductDetailScreen} />
      <Stack.Screen name="Suppliers"       component={SuppliersScreen} />
      <Stack.Screen name="SupplierProfile" component={SupplierProfileScreen} />
      <Stack.Screen name="IdeaToProduct"    component={IdeaToProductScreen} />
      <Stack.Screen name="Checkout"        component={CheckoutScreen} />
      <Stack.Screen name="Payment"         component={PaymentScreen} />
      <Stack.Screen name="ProductInquiries" component={ProductInquiriesScreen} />
      <Stack.Screen name="Samples"         component={SamplesScreen} />
      <Stack.Screen name="FAQ"             component={FAQScreen} />
      <Stack.Screen name="FAQTraders"      component={FAQTradersScreen} />
      <Stack.Screen name="FAQSuppliers"    component={FAQSuppliersScreen} />
      <Stack.Screen name="Terms"           component={TermsScreen} />
      <Stack.Screen name="Contact"         component={ContactScreen} />
      <Stack.Screen name="Support"         component={SupportScreen} />
      <Stack.Screen name="WebView"         component={WebViewScreen} />
      <Stack.Screen name="CalcTool"        component={CalcToolScreen} />
      <Stack.Screen name="OrderDetail"     component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

function RequestsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="RequestsList"    component={RequestsScreen} />
      <Stack.Screen name="NewRequestStack" component={NewRequestScreen} />
      <Stack.Screen name="IdeaToProduct"   component={IdeaToProductScreen} />
      <Stack.Screen name="AllOffers"       component={AllOffersScreen} />
      <Stack.Screen name="Offers"          component={OffersScreen} />
      <Stack.Screen name="Payment"         component={PaymentScreen} />
      <Stack.Screen name="ManagedRequest"  component={ManagedRequestScreen} />
      <Stack.Screen name="OrderDetail"     component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

function InboxStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="InboxList" component={InboxScreen} />
      <Stack.Screen name="Chat"      component={ChatScreen} />
    </Stack.Navigator>
  );
}

// Placeholder — never actually shown (tab press is intercepted)
function NewRequestTab() {
  return <View style={{ flex: 1, backgroundColor: C.bgBase }} />;
}

export default function BuyerTabs() {
  const [showModal, setShowModal] = useState(false);
  const tabNavRef = useRef(null);

  function handleOption(type) {
    setShowModal(false);
    setTimeout(() => {
      if (!tabNavRef.current) return;
      if (type === 'direct') {
        tabNavRef.current.navigate('Home', {
          screen: 'NewRequestStack',
          params: { mode: 'direct' },
        });
      } else if (type === 'managed') {
        tabNavRef.current.navigate('Home', {
          screen: 'NewRequestStack',
          params: { mode: 'managed' },
        });
      } else if (type === 'idea') {
        tabNavRef.current.navigate('Home', { screen: 'IdeaToProduct' });
      }
    }, 250);
  }

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => {
            if (route.name === 'NewRequest') {
              return (
                <View style={ms.plusCircle}>
                  <Text style={ms.plusIcon}>+</Text>
                </View>
              );
            }
            const icons = { Home: '⌂', Requests: '≡', Inbox: '◎', Account: '○' };
            return (
              <Text style={[
                ms.tabIcon,
                route.name === 'Home' && { fontSize: 19 },
                { color: focused ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.32)' },
              ]}>
                {icons[route.name]}
              </Text>
            );
          },
          tabBarLabel: ({ focused }) => {
            if (route.name === 'NewRequest') return null;
            const labels = {
              Home:     'الرئيسية',
              Requests: 'طلباتي',
              Inbox:    'رسائل',
              Account:  'حسابي',
            };
            return (
              <Text style={{
                fontSize: 10,
                fontFamily: focused ? F.arSemi : F.ar,
                color: focused ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.32)',
                marginTop: 2,
              }}>
                {labels[route.name]}
              </Text>
            );
          },
          tabBarStyle: {
            backgroundColor: C.bgRaised,
            borderTopColor: 'rgba(0,0,0,0.07)',
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          },
          tabBarItemStyle: { justifyContent: 'center', alignItems: 'center' },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          listeners={({ navigation }) => ({
            focus: () => { tabNavRef.current = navigation; },
          })}
        />
        <Tab.Screen
          name="NewRequest"
          component={NewRequestTab}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              tabNavRef.current = navigation;
              setShowModal(true);
            },
          })}
        />
        <Tab.Screen name="Requests"   component={RequestsStack} />
        <Tab.Screen name="Inbox"      component={InboxStack} />
        <Tab.Screen name="Account"    component={AccountScreen} />
      </Tab.Navigator>

      <AIHub goTo={(screen) => {
        if (tabNavRef.current) tabNavRef.current.navigate('Home', { screen });
      }} />

      {/* ── New Request Bottom Sheet ────────────────────────────────── */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <View style={ms.overlay}>
            <TouchableWithoutFeedback>
              <View style={ms.sheet}>
                <View style={ms.handle} />

                {/* ارفع طلبك */}
                <Text style={ms.sectionHead}>ارفع طلبك</Text>

                <TouchableOpacity
                  style={ms.option}
                  activeOpacity={0.75}
                  onPress={() => handleOption('direct')}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={ms.optionTitle}>طلب عادي</Text>
                    <Text style={ms.optionSub}>لمنتج واضح وتحتاج عروض مباشرة من الموردين</Text>
                  </View>
                  <Text style={ms.optionArrow}>←</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={ms.option}
                  activeOpacity={0.75}
                  onPress={() => handleOption('managed')}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={ms.optionTitle}>الطلب المُدار</Text>
                    <Text style={ms.optionSub}>معبر يبحث لك ويعرض أفضل 3 خيارات من موردين مختارين</Text>
                  </View>
                  <Text style={ms.optionArrow}>←</Text>
                </TouchableOpacity>

                <View style={ms.divider} />

                {/* اصنع فكرتك */}
                <TouchableOpacity
                  style={[ms.option, { marginBottom: 8 }]}
                  activeOpacity={0.75}
                  onPress={() => handleOption('idea')}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={ms.optionTitle}>اصنع فكرتك</Text>
                    <Text style={ms.optionSub}>حوّل فكرتك إلى طلب احترافي بمساعدة الذكاء الاصطناعي</Text>
                  </View>
                  <Text style={ms.optionArrow}>←</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const ms = StyleSheet.create({
  // Tab icons
  tabIcon:   { fontSize: 16, fontFamily: F.en, lineHeight: 20 },
  plusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  plusIcon: { color: '#fff', fontSize: 26, lineHeight: 30, fontFamily: F.enLight },

  // Modal overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  // Bottom sheet
  sheet: {
    backgroundColor: C.bgBase,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.borderDefault,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // Section head
  sectionHead: {
    fontFamily: F.arBold,
    fontSize: 13,
    color: C.textTertiary,
    textAlign: 'right',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Option row
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  optionTitle: {
    fontFamily: F.arBold,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'right',
    marginBottom: 3,
  },
  optionSub: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'right',
    lineHeight: 18,
  },
  optionArrow: {
    color: C.textDisabled,
    fontSize: 16,
    fontFamily: F.en,
  },

  divider: {
    height: 1,
    backgroundColor: C.borderSubtle,
    marginVertical: 8,
  },
});
