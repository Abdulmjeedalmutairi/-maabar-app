import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../../lib/colors';

export default function StatCard({ label, value, onPress, highlight = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        highlight ? styles.highlightContainer : styles.normalContainer,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[
        styles.value,
        highlight ? styles.highlightValue : styles.normalValue,
      ]}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 20,
    flex: 1,
    minHeight: 100,
    justifyContent: 'center',
  },
  normalContainer: {
    backgroundColor: C.bgSubtle,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  highlightContainer: {
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderMuted,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.textDisabled,
    marginBottom: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
  value: {
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 40,
    letterSpacing: -1,
  },
  normalValue: {
    color: C.textSecondary,
  },
  highlightValue: {
    color: C.textPrimary,
  },
});