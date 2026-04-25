/**
 * CheckoutScreen — Direct Purchase "Buy Now" form
 * Mirrors web src/pages/ProductDetail.jsx submitOrder behaviour.
 *
 * Single-step form: quantity + optional note.
 * Confirm → inserts a `requests` row with status='pending_supplier_confirmation',
 *           inserts a notification to the supplier (type='direct_order_pending'),
 *           sends the supplier email (type='direct_order_pending'),
 *           shows an inline "تم إرسال طلبك، بانتظار تأكيد المورد" success card.
 *
 * NO payment happens at this stage — the buyer pays in Step 4 of the flow,
 * after the supplier confirms within 24 hours.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, SUPABASE_ANON_KEY, SEND_EMAIL_URL } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

/* ─────────────────────────────────────────────────────────────────── */
/* Helpers                                                             */
/* ─────────────────────────────────────────────────────────────────── */

function parseMoq(moq) {
  if (!moq) return 1;
  const n = parseInt(String(moq).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 1 : n;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Reusable sub-components                                             */
/* ─────────────────────────────────────────────────────────────────── */

function SectionCard({ title, children }) {
  return (
    <View style={s.card}>
      {!!title && <Text style={s.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function FieldLabel({ text, required }) {
  return (
    <Text style={s.fieldLabel}>
      {text}{required && <Text style={{ color: C.red }}> *</Text>}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main screen                                                         */
/* ─────────────────────────────────────────────────────────────────── */

export default function CheckoutScreen({ navigation, route }) {
  const product = route.params?.product || {};
  const productId      = product.id;
  const productNameAr  = product.name_ar  || '';
  const productNameEn  = product.name_en  || '';
  const productNameZh  = product.name_zh  || '';
  const priceUsd       = product.price_from ?? null;
  const moq            = product.moq       ?? 1;
  const category       = product.category  || 'other';
  const supplierId     = product.supplier_id || null;

  const moqNum   = parseMoq(moq);
  const hasPrice = priceUsd != null && Number(priceUsd) > 0;

  /* ── State ── */
  const [quantity,   setQuantity]   = useState(String(moqNum));
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  /* ── Derived ── */
  const qty         = parseInt(quantity, 10) || 0;
  const belowMoq    = qty > 0 && qty < moqNum;
  const productName = productNameAr || productNameEn || '';

  /* ── Submit (mirrors web submitOrder) ── */
  async function handleConfirm() {
    setError('');

    if (!quantity.trim() || qty < 1) {
      setError('يرجى إدخال الكمية.');
      return;
    }
    if (qty < moqNum) {
      setError(`الحد الأدنى للطلب هو ${moqNum} وحدة.`);
      return;
    }
    if (!productId) {
      setError('بيانات المنتج غير مكتملة.');
      return;
    }
    if (!supplierId) {
      setError('تعذّر تحديد المورد.');
      return;
    }

    const userRes = await supabase.auth.getUser();
    console.log('[CheckoutScreen.handleConfirm] auth.getUser response:', userRes);
    const user = userRes.data?.user;
    if (!user) { navigation.navigate('Login'); return; }

    setSubmitting(true);

    const productNameForEmail = productNameAr || productNameEn || productNameZh || '';

    const requestPayload = {
      buyer_id:        user.id,
      title_ar:        'شراء: ' + (productNameAr || productNameEn || productNameZh),
      title_en:        'Buy: '  + (productNameEn || productNameZh || productNameAr),
      title_zh:        '采购: ' + (productNameZh || productNameEn || productNameAr),
      quantity:        String(qty),
      description:     notes.trim(),
      product_ref:     productId,
      category:        category || 'other',
      status:          'pending_supplier_confirmation',
      payment_plan:    100,
      sample_requirement: 'none',
      budget_per_unit: hasPrice ? Number(priceUsd) : null,
    };

    const reqRes = await supabase.from('requests').insert(requestPayload).select().single();
    console.log('[CheckoutScreen.handleConfirm] requests.insert response:', reqRes);
    if (reqRes.error) {
      setSubmitting(false);
      setError('تعذر إنشاء الطلب — حاول مرة أخرى.');
      console.error('[CheckoutScreen.handleConfirm] insert error:', reqRes.error);
      return;
    }

    const requestId = reqRes.data?.id;

    const notifRes = await supabase.from('notifications').insert({
      user_id:  supplierId,
      type:     'direct_order_pending',
      title_ar: `طلب شراء مباشر جديد: ${productNameForEmail} — تأكيد خلال 24 ساعة`,
      title_en: `New direct purchase order: ${productNameForEmail} — confirm within 24 hours`,
      title_zh: `新直接采购订单：${productNameForEmail} — 请在 24 小时内确认`,
      ref_id:   requestId,
      is_read:  false,
    }).select().single();
    console.log('[CheckoutScreen.handleConfirm] notifications.insert response:', notifRes);

    try {
      const emailResp = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'direct_order_pending',
          data: {
            recipientUserId: supplierId,
            productName: productNameForEmail,
            quantity: String(qty),
          },
        }),
      });
      const emailBody = await emailResp.json().catch(() => null);
      console.log('[CheckoutScreen.handleConfirm] send-email response:', { status: emailResp.status, body: emailBody });
    } catch (emailError) {
      console.error('[CheckoutScreen.handleConfirm] send-email error:', emailError);
    }

    setSubmitting(false);
    setSuccess(true);
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <View style={s.successCircle}>
            <Text style={s.successCheck}>✓</Text>
          </View>
          <Text style={s.successTitle}>تم إرسال طلبك، بانتظار تأكيد المورد</Text>
          <Text style={s.successSub}>
            سيتم تأكيد الطلب من المورد خلال 24 ساعة. ستصلك إشعار فور الرد، ثم تنتقل إلى خطوة الدفع.
          </Text>
          <TouchableOpacity
            style={s.successBtn}
            onPress={() => navigation.navigate('BuyerHome')}
            activeOpacity={0.85}
          >
            <Text style={s.successBtnText}>العودة للرئيسية</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.successSecondary}
            onPress={() => navigation.navigate('Requests')}
            activeOpacity={0.75}
          >
            <Text style={s.successSecondaryText}>عرض طلباتي</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Render ── */
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={s.backText}>← رجوع</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>إرسال الطلب</Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Scrollable content */}
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionCard title="تفاصيل الطلب">
            {/* Product name — read-only */}
            <View style={s.fieldWrap}>
              <FieldLabel text="المنتج" />
              <View style={s.readonlyInput}>
                <Text style={s.readonlyText}>{productName || '—'}</Text>
              </View>
            </View>

            {/* Quantity */}
            <View style={s.fieldWrap}>
              <FieldLabel text="الكمية" required />
              <TextInput
                style={[s.input, belowMoq && s.inputWarn]}
                value={quantity}
                onChangeText={v => { setQuantity(v); setError(''); }}
                keyboardType="numeric"
                placeholderTextColor={C.textDisabled}
                textAlign="right"
              />
              {belowMoq && (
                <Text style={s.warnText}>
                  الحد الأدنى للطلب {moqNum} وحدة
                </Text>
              )}
              {moqNum > 1 && !belowMoq && (
                <Text style={s.hintText}>الحد الأدنى: {moqNum} وحدة</Text>
              )}
            </View>
          </SectionCard>

          <SectionCard title="">
            <View style={s.fieldWrap}>
              <FieldLabel text="ملاحظات إضافية (اختياري)" />
              <TextInput
                style={[s.input, s.inputMulti]}
                value={notes}
                onChangeText={setNotes}
                placeholder="مثلاً: التغليف، المواصفات النهائية، علامة خاصة..."
                placeholderTextColor={C.textDisabled}
                textAlign="right"
                textAlignVertical="top"
                multiline
                numberOfLines={3}
              />
            </View>
          </SectionCard>

          <View style={s.infoNotice}>
            <Text style={s.infoNoticeText}>
              عند إرسال الطلب، سيتم إخطار المورد. عليك انتظار تأكيده خلال 24 ساعة قبل خطوة الدفع.
            </Text>
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}
        </ScrollView>

        {/* Footer CTA */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.ctaBtn, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={s.ctaBtnText}>{submitting ? '…' : 'إرسال الطلب'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Styles                                                              */
/* ─────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.bgBase },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.bgRaised,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle: { fontFamily: F.arBold, fontSize: 17, color: C.textPrimary },
  backText:  { fontFamily: F.ar, fontSize: 14, color: C.textSecondary },

  scroll: { padding: 16, paddingBottom: 32, gap: 12 },

  /* Cards */
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 16,
  },
  cardTitle: {
    fontFamily: F.arSemi,
    fontSize: 14,
    color: C.textPrimary,
    marginBottom: 14,
    textAlign: 'right',
  },

  /* Fields */
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    fontFamily: F.ar,
    fontSize: 14,
    color: C.textPrimary,
    backgroundColor: C.bgBase,
    borderWidth: 1,
    borderColor: C.borderMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  inputMulti: { minHeight: 92 },
  inputWarn: { borderColor: C.amber },
  warnText: {
    fontFamily: F.ar,
    fontSize: 11,
    color: C.amber,
    marginTop: 4,
    textAlign: 'right',
  },
  hintText: {
    fontFamily: F.ar,
    fontSize: 11,
    color: C.textDisabled,
    marginTop: 4,
    textAlign: 'right',
  },
  readonlyInput: {
    backgroundColor: C.bgSubtle,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  readonlyText: {
    fontFamily: F.ar,
    fontSize: 14,
    color: C.textPrimary,
    textAlign: 'right',
  },

  /* Info notice */
  infoNotice: {
    backgroundColor: C.bgSubtle,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 8,
    padding: 12,
  },
  infoNoticeText: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 20,
    textAlign: 'right',
  },

  /* Error */
  error: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.red,
    textAlign: 'center',
    marginTop: 8,
  },

  /* Footer */
  footer: {
    backgroundColor: C.bgRaised,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontFamily: F.arBold,
    fontSize: 15,
    color: '#fff',
  },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(45,122,79,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  successCheck: {
    fontFamily: F.enSemi,
    fontSize: 32,
    color: '#2d7a4f',
  },
  successTitle: {
    fontFamily: F.arBold,
    fontSize: 18,
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  successSub: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  successBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 10,
  },
  successBtnText: {
    fontFamily: F.arBold,
    fontSize: 14,
    color: '#fff',
  },
  successSecondary: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  successSecondaryText: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.textSecondary,
  },
});
