import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../../lib/colors';

export default function QuickAction({ 
  title, 
  subtitle, 
  onPress, 
  primary = false,
  isArabic = false 
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        primary ? styles.primaryContainer : styles.normalContainer,
      ]}
    >
      <Text style={[
        styles.title,
        { fontFamily: isArabic ? 'System' : 'System' },
      ]}>
        {title}
      </Text>
      <Text style={[
        styles.subtitle,
        { fontFamily: isArabic ? 'System' : 'System' },
      ]}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  normalContainer: {
    backgroundColor: C.bgSubtle,
    borderColor: C.borderSubtle,
  },
  primaryContainer: {
    backgroundColor: C.bgRaised,
    borderColor: C.borderMuted,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: C.textTertiary,
    lineHeight: 18,
  },
});