import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';
import { setLang } from '../../lib/lang';

const LANGUAGES = [
  { code: 'AR', label: 'العربية', font: F.arBold, size: 22 },
  { code: 'EN', label: 'English',  font: F.enSemi,  size: 20 },
  { code: 'ZH', label: '中文',     font: F.enSemi,  size: 22 },
];

export default function LanguageScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>

        <View style={s.logoWrap}>
          <MaabarLogo size="lg" />
        </View>

        <View style={s.list}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={s.card}
              onPress={() => { setLang(lang.code); navigation.navigate('Role', { language: lang.code }); }}
              activeOpacity={0.8}
            >
              <Text style={[s.cardLabel, { fontFamily: lang.font, fontSize: lang.size }]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 56,
  },
  list: { gap: 12 },
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  cardLabel: {
    color: C.textPrimary,
  },
});
