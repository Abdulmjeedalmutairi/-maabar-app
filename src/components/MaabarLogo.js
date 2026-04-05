import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../lib/colors';

export default function MaabarLogo({ size = 'md' }) {
  const s = size === 'lg' ? 1.4 : 1;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.arabic, { fontSize: 16 * s }]}>مَعبر</Text>
      <Text style={[styles.latin, { fontSize: 8 * s }]}>MAABAR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.borderDefault,
    alignItems: 'center',
  },
  arabic: {
    color: C.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  latin: {
    color: C.textDisabled,
    letterSpacing: 3,
    marginTop: 1,
  },
});
