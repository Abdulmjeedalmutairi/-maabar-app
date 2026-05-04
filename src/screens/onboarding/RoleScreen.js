import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';
import { getLang } from '../../lib/lang';

const T = {
  ar: { buyer: 'تاجر', supplier: 'مورد' },
  en: { buyer: 'Buyer', supplier: 'Supplier' },
  zh: { buyer: '采购商', supplier: '供应商' },
};

export default function RoleScreen({ navigation }) {
  const lang = getLang();
  const t = T[lang] || T.ar;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>

        <View style={s.logoWrap}>
          <MaabarLogo size="lg" />
        </View>

        <View style={s.cards}>

          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('TraderHome')}
            activeOpacity={0.75}
          >
            <Text style={s.cardTitle}>{t.buyer}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('Login', { initialTab: 'supplier' })}
            activeOpacity={0.75}
          >
            <Text style={s.cardTitle}>{t.supplier}</Text>
          </TouchableOpacity>

        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 56,
  },
  cards: { gap: 14 },
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderDefault,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: C.textPrimary,
    fontFamily: F.arBold,
    fontSize: 30,
  },
});
