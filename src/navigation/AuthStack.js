import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LanguageScreen        from '../screens/onboarding/LanguageScreen';
import RoleScreen            from '../screens/onboarding/RoleScreen';
import PublicHomeScreen      from '../screens/public/PublicHomeScreen';
import LoginScreen           from '../screens/auth/LoginScreen';
import SignupBuyerScreen     from '../screens/auth/SignupBuyerScreen';
import SignupSupplierScreen  from '../screens/auth/SignupSupplierScreen';
import ProductsScreen        from '../screens/shared/ProductsScreen';
import ProductDetailScreen   from '../screens/shared/ProductDetailScreen';
import SuppliersScreen       from '../screens/shared/SuppliersScreen';
import SupplierProfileScreen from '../screens/shared/SupplierProfileScreen';
// Guest-accessible form screens (sign-up gate fires only on final submit)
import NewRequestScreen      from '../screens/buyer/NewRequestScreen';
import IdeaToProductScreen   from '../screens/buyer/IdeaToProductScreen';
import SupplierLandingScreen from '../screens/public/SupplierLandingScreen';
import SupplierAccessScreen  from '../screens/public/SupplierAccessScreen';
import FAQScreen             from '../screens/shared/FAQScreen';
import FAQTradersScreen      from '../screens/shared/FAQTradersScreen';
import FAQSuppliersScreen    from '../screens/shared/FAQSuppliersScreen';
import TermsScreen           from '../screens/shared/TermsScreen';
import ContactScreen         from '../screens/shared/ContactScreen';
import SupportScreen         from '../screens/shared/SupportScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack({ initialRoute = 'Language' }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Language"        component={LanguageScreen} />
      <Stack.Screen name="Role"            component={RoleScreen} />
      <Stack.Screen name="TraderHome"      component={PublicHomeScreen} />
      <Stack.Screen name="Login"           component={LoginScreen} />
      <Stack.Screen name="SignupBuyer"     component={SignupBuyerScreen} />
      <Stack.Screen name="SignupSupplier"  component={SignupSupplierScreen} />
      {/* Guest-accessible screens — no auth required to browse or fill forms */}
      <Stack.Screen name="Products"        component={ProductsScreen} />
      <Stack.Screen name="ProductDetail"   component={ProductDetailScreen} />
      <Stack.Screen name="Suppliers"       component={SuppliersScreen} />
      <Stack.Screen name="SupplierProfile" component={SupplierProfileScreen} />
      <Stack.Screen name="NewRequest"       component={NewRequestScreen} />
      <Stack.Screen name="IdeaToProduct"   component={IdeaToProductScreen} />
      <Stack.Screen name="SupplierLanding" component={SupplierLandingScreen} />
      <Stack.Screen name="SupplierAccess"  component={SupplierAccessScreen} />
      <Stack.Screen name="FAQ"             component={FAQScreen} />
      <Stack.Screen name="FAQTraders"      component={FAQTradersScreen} />
      <Stack.Screen name="FAQSuppliers"    component={FAQSuppliersScreen} />
      <Stack.Screen name="Terms"           component={TermsScreen} />
      <Stack.Screen name="Contact"         component={ContactScreen} />
      <Stack.Screen name="Support"         component={SupportScreen} />
    </Stack.Navigator>
  );
}
