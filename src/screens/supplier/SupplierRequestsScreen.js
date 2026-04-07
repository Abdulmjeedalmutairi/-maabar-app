import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const COPY = {
  ar: {
    title: 'الطلبات المتاحة',
    noRequests: 'لا توجد طلبات مفتوحة حالياً',
    budget: 'الميزانية',
    qty: 'الكمية',
    sendOffer: 'إرسال عرض',
    offerTitle: 'إرسال عرض',
    close: 'إغلاق',
    unitPrice: 'سعر الوحدة (USD) *',
    shipping: 'تكلفة الشحن (USD)',
    shippingMethod: 'طريقة الشحن',
    moq: 'الحد الأدنى للكمية (MOQ)',
    deliveryDays: 'مدة التسليم (أيام) *',
    origin: 'بلد المنشأ',
    note: 'ملاحظة',
    submit: 'إرسال العرض',
    offerSent: 'تم إرسال العرض بنجاح',
    errorPrice: 'أدخل سعر الوحدة ومدة التسليم',
    errorGeneric: 'حدث خطأ، حاول مرة أخرى',
    alreadyOfferred: 'قدمت عرضاً على هذا الطلب مسبقاً',
  },
  en: {
    title: 'Open Requests',
    noRequests: 'No open requests at the moment',
    budget: 'Budget',
    qty: 'Qty',
    sendOffer: 'Send Offer',
    offerTitle: 'Send Offer',
    close: 'Close',
    unitPrice: 'Unit Price (USD) *',
    shipping: 'Shipping Cost (USD)',
    shippingMethod: 'Shipping Method',
    moq: 'MOQ',
    deliveryDays: 'Delivery Days *',
    origin: 'Origin',
    note: 'Note',
    submit: 'Submit Offer',
    offerSent: 'Offer submitted successfully',
    errorPrice: 'Please enter unit price and delivery days',
    errorGeneric: 'Something went wrong, please try again',
    alreadyOfferred: 'You already submitted an offer on this request',
  },
  zh: {
    title: '开放询盘',
    noRequests: '暂时没有开放的询盘',
    budget: '预算',
    qty: '数量',
    sendOffer: '发送报价',
    offerTitle: '发送报价',
    close: '关闭',
    unitPrice: '单价 (USD) *',
    shipping: '运费 (USD)',
    shippingMethod: '运输方式',
    moq: '最小起订量',
    deliveryDays: '交期（天）*',
    origin: '原产地',
    note: '备注',
    submit: '提交报价',
    offerSent: '报价已成功提交',
    errorPrice: '请填写单价和交期',
    errorGeneric: '出现错误，请重试',
    alreadyOfferred: '您已对该询盘提交过报价',
  },
};

export default function SupplierRequestsScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState(null);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [form, setForm] = useState({
    price: '', shippingCost: '', shippingMethod: '', moq: '', days: '', origin: 'China', note: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    // Exact web query from loadRequests() — open + offers_received, direct mode only
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .in('status', ['open', 'offers_received'])
      .or('sourcing_mode.is.null,sourcing_mode.eq.direct')
      .order('created_at', { ascending: false });

    console.log('[SupplierRequests] requests:', data?.length, 'error:', error);
    setRequests(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }
  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openOffer(r) {
    setSelectedRequest(r);
    setForm({ price: '', shippingCost: '', shippingMethod: '', moq: '', days: '', origin: 'China', note: '' });
  }

  async function submitOffer() {
    const price = parseFloat(form.price);
    const days = parseInt(form.days, 10);

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
      Alert.alert('', t.errorPrice);
      return;
    }

    setSubmitting(true);

    // Check for existing offer (exact web logic)
    const { data: existing } = await supabase
      .from('offers')
      .select('id')
      .eq('request_id', selectedRequest.id)
      .eq('supplier_id', myId)
      .not('status', 'eq', 'cancelled')
      .limit(1)
      .maybeSingle();

    if (existing) {
      setSubmitting(false);
      Alert.alert('', t.alreadyOfferred);
      return;
    }

    const { error } = await supabase.from('offers').insert({
      request_id: selectedRequest.id,
      supplier_id: myId,
      price,
      shipping_cost: form.shippingCost ? parseFloat(form.shippingCost) : null,
      shipping_method: form.shippingMethod || null,
      moq: form.moq || null,
      delivery_days: days,
      origin: form.origin || 'China',
      note: form.note || null,
      status: 'pending',
    });

    setSubmitting(false);

    if (error) { console.error('[SupplierRequests] submitOffer error:', error); Alert.alert('', t.errorGeneric); return; }

    // Update request status to offers_received
    await supabase.from('requests')
      .update({ status: 'offers_received' })
      .eq('id', selectedRequest.id)
      .eq('status', 'open');

    // Notify buyer
    if (selectedRequest.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: selectedRequest.buyer_id,
        type: 'new_offer',
        title_ar: 'وصلك عرض جديد على طلبك',
        title_en: 'You received a new offer',
        title_zh: '您收到了新报价',
        ref_id: selectedRequest.id,
        is_read: false,
      });
    }

    setSelectedRequest(null);
    load();
    Alert.alert('✓', t.offerSent);
  }

  const getTitle = (r) => {
    if (lang === 'ar') return r.title_ar || r.title_en || r.title_zh || '—';
    if (lang === 'zh') return r.title_zh || r.title_en || r.title_ar || '—';
    return r.title_en || r.title_ar || r.title_zh || '—';
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={[s.pageTitle, isAr && s.rtl]}>{t.title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
        >
          {requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={[s.emptyText, isAr && s.rtl]}>{t.noRequests}</Text>
            </View>
          ) : requests.map(r => (
            <View key={r.id} style={s.card}>
              <View style={[s.cardHeader, isAr && s.rowRtl]}>
                {r.category ? (
                  <View style={s.catBadge}>
                    <Text style={s.catText}>{r.category}</Text>
                  </View>
                ) : null}
                <Text style={[s.cardTitle, isAr && s.rtl]} numberOfLines={2}>{getTitle(r)}</Text>
              </View>

              {!!r.description && (
                <Text style={[s.cardDesc, isAr && s.rtl]} numberOfLines={3}>{r.description}</Text>
              )}

              <View style={[s.cardMeta, isAr && s.rowRtl]}>
                {!!r.budget_per_unit && (
                  <Text style={s.metaItem}>{t.budget}: ${r.budget_per_unit}</Text>
                )}
                {!!r.quantity && (
                  <Text style={s.metaItem}>{t.qty}: {r.quantity}</Text>
                )}
              </View>

              <TouchableOpacity
                style={s.offerBtn}
                onPress={() => openOffer(r)}
                activeOpacity={0.85}
              >
                <Text style={s.offerBtnText}>{t.sendOffer}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Offer Modal ── */}
      <Modal visible={!!selectedRequest} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.offerTitle}</Text>
              </View>

              {selectedRequest && (
                <View style={s.reqSummary}>
                  <Text style={[s.reqSummaryTitle, isAr && s.rtl]}>{getTitle(selectedRequest)}</Text>
                  {!!selectedRequest.quantity && (
                    <Text style={[s.reqSummaryQty, isAr && s.rtl]}>{t.qty}: {selectedRequest.quantity}</Text>
                  )}
                </View>
              )}

              <RField label={t.unitPrice} value={form.price} onChangeText={v => setF('price', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.shipping} value={form.shippingCost} onChangeText={v => setF('shippingCost', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.shippingMethod} value={form.shippingMethod} onChangeText={v => setF('shippingMethod', v)} isAr={isAr} />
              <RField label={t.moq} value={form.moq} onChangeText={v => setF('moq', v)} isAr={isAr} />
              <RField label={t.deliveryDays} value={form.days} onChangeText={v => setF('days', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.origin} value={form.origin} onChangeText={v => setF('origin', v)} isAr={isAr} />
              <RField label={t.note} value={form.note} onChangeText={v => setF('note', v)} multiline numberOfLines={3} isAr={isAr} />

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitOffer}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.submit}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function RField({ label, isAr, multiline, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, isAr && s.rtl]}>{label}</Text>
      <TextInput
        style={[s.input, isAr && s.rtl, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={C.textDisabled}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  topBar: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontSize: 20, fontFamily: F.arSemi },
  list: { padding: 16, gap: 12, paddingBottom: 48 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  cardTitle: { color: C.textPrimary, fontSize: 15, fontFamily: F.arSemi, flex: 1, lineHeight: 22 },
  cardDesc: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, marginBottom: 10, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', gap: 16, marginBottom: 14, flexWrap: 'wrap' },
  metaItem: { color: C.textTertiary, fontSize: 12, fontFamily: F.en },
  catBadge: {
    backgroundColor: C.bgOverlay, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  catText: { color: C.textSecondary, fontSize: 11, fontFamily: F.en },
  offerBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  offerBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 14 },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault, marginTop: 16,
  },
  emptyText: { color: C.textSecondary, fontSize: 14, fontFamily: F.ar },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },
  reqSummary: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  reqSummaryTitle: { color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi },
  reqSummaryQty: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, marginTop: 4 },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, fontFamily: F.ar,
  },
  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
