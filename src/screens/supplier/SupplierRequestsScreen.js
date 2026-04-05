import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function SupplierRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [myId, setMyId] = useState(null);

  const [offerForm, setOfferForm] = useState({ price: '', shippingCost: '', shippingMethod: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data } = await supabase
      .from('requests')
      .select('id, title_ar, title_en, description, quantity, category, status, created_at, budget_per_unit')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  function setOffer(k, v) { setOfferForm(f => ({ ...f, [k]: v })); }

  async function submitOffer() {
    if (!offerForm.price) { Alert.alert('', 'أدخل سعر الوحدة'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('offers').insert({
      request_id: selectedRequest.id,
      supplier_id: myId,
      price: parseFloat(offerForm.price),
      shipping_cost: offerForm.shippingCost ? parseFloat(offerForm.shippingCost) : null,
      shipping_method: offerForm.shippingMethod || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { Alert.alert('خطأ', 'حدث خطأ، حاول مرة أخرى'); return; }
    setSelectedRequest(null);
    setOfferForm({ price: '', shippingCost: '', shippingMethod: '' });
    Alert.alert('✓', 'تم إرسال العرض بنجاح');
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={s.pageTitle}>الطلبات المتاحة</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>لا توجد طلبات مفتوحة حالياً</Text>
            </View>
          ) : (
            requests.map(r => (
              <View key={r.id} style={s.card}>
                <View style={s.cardHeader}>
                  {r.category && (
                    <View style={s.catBadge}>
                      <Text style={s.catText}>{r.category}</Text>
                    </View>
                  )}
                  <Text style={s.cardTitle} numberOfLines={2}>{r.title_ar || r.title_en}</Text>
                </View>

                {!!r.description && (
                  <Text style={s.cardDesc} numberOfLines={3}>{r.description}</Text>
                )}

                <View style={s.cardMeta}>
                  {r.budget_per_unit && (
                    <Text style={s.metaItem}>الميزانية: ${r.budget_per_unit}</Text>
                  )}
                  <Text style={s.metaItem}>الكمية: {r.quantity}</Text>
                </View>

                <TouchableOpacity
                  style={s.offerBtn}
                  onPress={() => setSelectedRequest(r)}
                  activeOpacity={0.85}
                >
                  <Text style={s.offerBtnText}>إرسال عرض</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Offer Modal */}
      <Modal visible={!!selectedRequest} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                  <Text style={s.modalClose}>إغلاق</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>إرسال عرض</Text>
              </View>

              {selectedRequest && (
                <View style={s.reqSummary}>
                  <Text style={s.reqSummaryTitle}>{selectedRequest.title_ar || selectedRequest.title_en}</Text>
                  <Text style={s.reqSummaryQty}>{selectedRequest.quantity}</Text>
                </View>
              )}

              <OfferField label="سعر الوحدة (USD) *" value={offerForm.price}
                onChangeText={v => setOffer('price', v)} keyboardType="numeric" />
              <OfferField label="تكلفة الشحن (USD)" value={offerForm.shippingCost}
                onChangeText={v => setOffer('shippingCost', v)} keyboardType="numeric" />
              <OfferField label="طريقة الشحن" value={offerForm.shippingMethod}
                onChangeText={v => setOffer('shippingMethod', v)} />

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitOffer}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>إرسال العرض</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function OfferField({ label, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={C.textDisabled} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'right' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  cardTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'right', flex: 1 },
  cardDesc: { color: C.textSecondary, fontSize: 13, textAlign: 'right', marginBottom: 10, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 14 },
  metaItem: { color: C.textTertiary, fontSize: 12 },
  catBadge: {
    backgroundColor: C.accentSoft, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  catText: { color: C.accent, fontSize: 11 },
  offerBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  offerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontSize: 14 },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: C.accent, fontSize: 15 },
  reqSummary: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  reqSummaryTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  reqSummaryQty: { color: C.textSecondary, fontSize: 13, textAlign: 'right', marginTop: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, textAlign: 'right',
  },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
