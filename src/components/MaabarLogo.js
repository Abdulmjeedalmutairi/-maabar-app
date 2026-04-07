import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';

export default function MaabarLogo({ size = 'md' }) {
  const scale = size === 'lg' ? 1.4 : 1;
  return (
    <View style={s.wrap}>
      <View style={s.mainRow}>
        <Text style={[s.english, { fontSize: 13 * scale }]}>MAABAR</Text>
        <Text style={[s.sep, { fontSize: 13 * scale }]}> | </Text>
        <Text style={[s.arabic, { fontSize: 14 * scale }]}>مَعبر</Text>
      </View>
      <Text style={[s.chinese, { fontSize: 8 * scale }]}>迈巴尔</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  english: {
    color: C.textPrimary,
    fontFamily: F.enSemi,
    letterSpacing: 2,
  },
  sep: {
    color: C.textDisabled,
    fontFamily: F.en,
  },
  arabic: {
    color: C.textPrimary,
    fontFamily: F.arBold,
    letterSpacing: 0.3,
  },
  chinese: {
    color: C.textDisabled,
    fontFamily: F.en,
    letterSpacing: 2,
    marginTop: 2,
  },
});
