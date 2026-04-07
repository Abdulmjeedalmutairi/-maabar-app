import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../lib/colors';

export default function Screen({ children, style, edges }) {
  return (
    <SafeAreaView
      style={[styles.safe, style]}
      edges={edges ?? ['top', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bgBase} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bgBase,
  },
});
