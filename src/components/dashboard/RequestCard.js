import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../../lib/colors';
import StatusBar from './StatusBar';

const STATUS_COLOR = {
  open: C.blue,
  offers_received: C.green,
  closed: C.accent,
  paid: C.green,
  ready_to_ship: C.orange,
  shipping: C.orange,
  arrived: C.green,
  delivered: C.green,
};

export default function RequestCard({ 
  request, 
  onPress, 
  isArabic = false,
  displayCurrency = 'USD'
}) {
  const title = isArabic ? request.title_ar : request.title_en;
  const status = request.status || 'open';
  const quantity = request.quantity || 1;
  const unit = request.unit || 'pcs';
  
  // تنسيق التاريخ
  const date = new Date(request.created_at);
  const formattedDate = isArabic
    ? date.toLocaleDateString('ar-SA')
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: isArabic ? 'System' : 'System' }]}>
          {title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
            {isArabic ? 'نشط' : 'Active'}
          </Text>
        </View>
      </View>
      
      <View style={styles.details}>
        <Text style={styles.detailText}>
          {quantity} {unit}
        </Text>
        <Text style={styles.detailText}>
          {formattedDate}
        </Text>
      </View>
      
      <StatusBar status={status} isArabic={isArabic} />
      
      {request.offers_count > 0 && (
        <View style={styles.offersContainer}>
          <Text style={styles.offersText}>
            {isArabic ? `${request.offers_count} عرض` : `${request.offers_count} offers`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.bgSubtle,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: C.textTertiary,
  },
  offersContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
  },
  offersText: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '500',
  },
});