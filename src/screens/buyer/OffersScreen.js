import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

const OFFER_STATUS_AR = {
  pending: 'قيد الانتظار',
  accepted: 'مقبول',
  rejected: 'مرفوض',
  negotiating: 'قيد التفاوض',
};

export default function OffersScreen({ route, navigation }) {
  const { requestId, title } = route.params || {};
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;
    loadOffers();
  }, [requestId]);

  async function loadOffers() {
    const { data } = await supabase
      .from('offers')
      .select(`
        id, price, shipping_cost, shipping_method, status, created_at,
        profiles:supplier_id (id, company_name, maabar_supplier_id, trust_score)
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    setOffers(data || []);
    setLoading(false);
  }

  async function handleAccept(offerId) {
    Alert.alert('قبول العرض', 'هل أنت متأكد من قبول هذا العرض؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'قبول',
        onPress: async () => {
          await supabase.from('offers').update({ status: 'accepted' }).eq('id', offerId);
          await supabase.from('requests').update({ status: 'closed' }).eq('id', requestId);
          loadOffers();
        },
      },
    ]);
  }

  async function handleChat(supplierId) {
    navigation.navigate('Inbox', {
      screen: 'Chat',
      params: { partnerId: supplierId },
    });
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle} numberOfLines={1}>العروض</Text>
      </View>

      {!!title && <Text style={s.reqTitle}>{title}</Text>}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : offers.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>لا توجد عروض بعد</Text>
          <Text style={s.emptySubText}>سيصلك إشعار عند وصول العروض</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {offers.map(offer => {
            const total = (offer.price || 0) + (offer.shipping_cost || 0);
            const status = offer.status || 'pending';
            const isAccepted = status === 'accepted';
            return (
              <View key={offer.id} style={[s.card, isAccepted && s.cardAccepted]}>
                {/* Supplier */}
                <View style={s.supplierRow}>
                  {isAccepted && (
                    <View style={s.acceptedBadge}>
                      <Text style={s.acceptedText}>✓ مقبول</Text>
                    </View>
                  )}
                  <Text style={s.supplierName}>
                    {offer.profiles?.company_name || 'مورد'}
                  </Text>
                </View>
                {!!offer.profiles?.maabar_supplier_id && (
                  <Text style={s.supplierId}>{offer.profiles.maabar_supplier_id}</Text>
                )}

                {/* Pricing */}
                <View style={s.priceRow}>
                  <View style={s.priceItem}>
                    <Text style={s.priceLabel}>سعر الشحن</Text>
                    <Text style={s.priceValue}>${offer.shipping_cost?.toFixed(2) || '—'}</Text>
                  </View>
                  <View style={s.priceItem}>
                    <Text style={s.priceLabel}>سعر الوحدة</Text>
                    <Text style={s.priceValue}>${offer.price?.toFixed(2) || '—'}</Text>
                  </View>
                </View>

                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>الإجمالي</Text>
                  <Text style={s.totalValue}>${total.toFixed(2)}</Text>
                </View>

                {offer.shipping_method && (
                  <Text style={s.shippingMethod}>الشحن: {offer.shipping_method}</Text>
                )}

                {/* Actions */}
                {status === 'pending' && (
                  <View style={s.actions}>
                    <TouchableOpacity
                      style={s.chatBtn}
                      onPress={() => handleChat(offer.profiles?.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.chatBtnText}>تواصل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.acceptBtn}
                      onPress={() => handleAccept(offer.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={s.acceptBtnText}>قبول العرض</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  back: { color: C.accent, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '700', maxWidth: '70%', textAlign: 'right' },
  reqTitle: {
    color: C.textSecondary, fontSize: 13, textAlign: 'right',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  list: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 18,
    padding: 18, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardAccepted: { borderColor: C.green },

  supplierRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  supplierName: { color: C.textPrimary, fontWeight: '700', fontSize: 16, textAlign: 'right' },
  supplierId: { color: C.textDisabled, fontSize: 11, textAlign: 'right', marginBottom: 14 },
  acceptedBadge: {
    backgroundColor: C.greenSoft, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
  },
  acceptedText: { color: C.green, fontSize: 12, fontWeight: '700' },

  priceRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  priceItem: {
    flex: 1, backgroundColor: C.bgOverlay, borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  priceLabel: { color: C.textTertiary, fontSize: 11, marginBottom: 4 },
  priceValue: { color: C.textPrimary, fontWeight: '600', fontSize: 18 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
  },
  totalLabel: { color: C.textSecondary, fontSize: 13 },
  totalValue: { color: C.accent, fontWeight: '700', fontSize: 20 },

  shippingMethod: { color: C.textTertiary, fontSize: 12, textAlign: 'right', marginTop: 4 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chatBtn: {
    flex: 1, borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
    backgroundColor: C.bgOverlay,
  },
  chatBtnText: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  acceptBtn: {
    flex: 2, backgroundColor: C.accent,
    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyCard: {
    margin: 20, backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontSize: 15, marginBottom: 8 },
  emptySubText: { color: C.textTertiary, fontSize: 13 },
});
