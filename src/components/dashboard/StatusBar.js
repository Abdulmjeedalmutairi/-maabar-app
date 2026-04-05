import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../lib/colors';

const STATUS_STEPS = ['open', 'offers_received', 'closed', 'paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'];
const STATUS_AR = {
  open: 'مرفوع',
  offers_received: 'عروض وصلت',
  closed: 'عرض مقبول',
  paid: 'تم الدفع',
  ready_to_ship: 'الشحنة جاهزة',
  shipping: 'قيد الشحن',
  arrived: 'وصل السعودية',
  delivered: 'تم التسليم',
};
const STATUS_EN = {
  open: 'Posted',
  offers_received: 'Offers In',
  closed: 'Accepted',
  paid: 'Paid',
  ready_to_ship: 'Ready to Ship',
  shipping: 'Shipping',
  arrived: 'Arrived',
  delivered: 'Delivered',
};

export default function StatusBar({ status, isArabic = false }) {
  const currentIndex = STATUS_STEPS.indexOf(status);
  const current = currentIndex === -1 ? 0 : currentIndex;
  const label = isArabic 
    ? (STATUS_AR[status] || STATUS_AR.open)
    : (STATUS_EN[status] || STATUS_EN.open);

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        {STATUS_STEPS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index <= current ? styles.activeSegment : styles.inactiveSegment,
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  progressSegment: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  activeSegment: {
    backgroundColor: C.textTertiary,
  },
  inactiveSegment: {
    backgroundColor: C.borderSubtle,
  },
  label: {
    fontSize: 10,
    color: C.textSecondary,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});