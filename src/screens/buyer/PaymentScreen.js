/**
 * PaymentScreen — Moyasar card payment
 *
 * Params:
 *   amount          — SAR amount (number)
 *   type            — 'checkout' | 'second_installment' | 'sample' | 'offer'
 *   requestData     — (checkout) object to insert into requests table
 *   requestId       — (second_installment / offer) request id to update
 *   offerId         — (offer) offer id to update
 *   sampleId        — (sample) sample id to update
 *
 * Flow:
 *   1. User enters card details
 *   2. POST to Moyasar API → creditcard source
 *   3a. status === 'paid' → run DB action → show success
 *   3b. source.transaction_url exists → open in expo-web-browser → deep link callback
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { supabase, SUPABASE_ANON_KEY, SEND_EMAIL_URL } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';

const MOYASAR_API = 'https://api.moyasar.com/v1/payments';
const MOYASAR_KEY = process.env.EXPO_PUBLIC_MOYASAR_API_KEY || 'pk_test_gYDMsvJ8sAetQWtBXfzGPMz6B1kiu38TJYTJu5Rn';

function fmtSAR(n) {
  const num = Number(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(2);
}

const tx = (ar, en) => getLang() === 'ar' ? ar : en;

function formatCardNumber(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function PaymentScreen({ navigation, route }) {
  const {
    amount = 0,
    type = 'checkout',
    requestData,
    requestId,
    offerId,
    sampleId,
    supplierId,    // offer's supplier_id (or product.supplier_id for direct purchase)
    offerPriceUsd, // total (price+shipping) in USD; absent → amount/3.75
    paymentPct,    // e.g. 30 for 30/70 split, 100 for direct purchase
    isDirect,      // direct purchase flow — passed from BuyerDirectOrdersScreen.payDirectOrder
    productRef,    // direct purchase — the product UUID, mirrors requests.product_ref
  } = route.params || {};

  const [name, setName]       = useState('');
  const [card, setCard]       = useState('');
  const [expiry, setExpiry]   = useState('');
  const [cvv, setCvv]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const amountHalalas = Math.round(amount * 100);

  function validate() {
    if (!name.trim())            { setError(tx('أدخل اسم حامل البطاقة', 'Enter cardholder name')); return false; }
    const cardDigits = card.replace(/\s/g, '');
    if (cardDigits.length !== 16) { setError(tx('رقم البطاقة غير صحيح', 'Invalid card number')); return false; }
    const parts = expiry.split('/');
    if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
      setError(tx('تاريخ انتهاء غير صحيح', 'Invalid expiry date')); return false;
    }
    if (cvv.length < 3)          { setError(tx('رمز CVV غير صحيح', 'Invalid CVV')); return false; }
    return true;
  }

  async function handlePay() {
    if (!validate()) return;
    setError('');
    setLoading(true);

    const cardDigits = card.replace(/\s/g, '');
    const [month, year] = expiry.split('/');
    const callbackUrl = `maabar://payment?type=${type}`;

    const basicAuth = btoa(`${MOYASAR_KEY}:`);

    let res;
    try {
      const response = await fetch(MOYASAR_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: amountHalalas,
          currency: 'SAR',
          description: tx('دفع عبر معبر', 'Payment via Maabar'),
          callback_url: callbackUrl,
          source: {
            type: 'creditcard',
            name: name.trim(),
            number: cardDigits,
            month,
            year: `20${year}`,
            cvc: cvv,
          },
        }),
      });
      res = await response.json();
    } catch (err) {
      setError(tx('فشل الاتصال، حاول مجدداً', 'Connection failed, try again'));
      setLoading(false);
      return;
    }

    if (res.status === 'paid') {
      await runDbAction(res.id);
      setLoading(false);
      setSuccess(true);
      return;
    }

    if (res.source?.transaction_url) {
      setLoading(false);
      const result = await WebBrowser.openAuthSessionAsync(
        res.source.transaction_url,
        'maabar://payment'
      );

      if (result.type === 'success' && result.url?.includes('status=paid')) {
        setLoading(true);
        await runDbAction(res.id);
        setLoading(false);
        setSuccess(true);
      } else {
        setError(tx('لم يكتمل التحقق، حاول مجدداً', '3DS verification incomplete, try again'));
      }
      return;
    }

    const apiError = res.message || res.error || JSON.stringify(res);
    setError(apiError);
    setLoading(false);
  }

  async function runDbAction(moyasarId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[PaymentScreen] runDbAction user:', user?.id, 'type:', type, 'moyasarId:', moyasarId);

      let resolvedRequestId = requestId;
      let resolvedSupplierId = supplierId || null;

      // ── 1. DB state transition ──────────────────────────────────────
      if (type === 'checkout') {
        if (requestId) {
          // Existing request (accepted offer, first installment) — promote to paid
          const pct = paymentPct || 30;
          const totalUsd = offerPriceUsd != null ? offerPriceUsd : amount / 3.75;
          const second = parseFloat((totalUsd * (1 - pct / 100)).toFixed(2));
          const { data, error } = await supabase
            .from('requests')
            .update({ status: 'paid', payment_pct: pct, payment_second: second })
            .eq('id', requestId);
          console.log('[PaymentScreen] requests.update checkout:', data, error);
        } else if (requestData && user) {
          // New request from product checkout — create it
          const { data, error } = await supabase
            .from('requests')
            .insert({ ...requestData, buyer_id: user.id, status: 'open' })
            .select('id')
            .single();
          console.log('[PaymentScreen] requests.insert checkout:', data, error);
          if (data?.id) resolvedRequestId = data.id;
        }
      } else if (type === 'second_installment' && requestId) {
        const { data, error } = await supabase
          .from('requests')
          .update({ status: 'shipping', shipping_status: 'shipping' })
          .eq('id', requestId);
        console.log('[PaymentScreen] requests.update second_installment:', data, error);
      } else if (type === 'offer' && requestId) {
        // Cascade (accept offer, reject others, notify) already done in OffersScreen.
        // Just transition request to paid.
        const pct = paymentPct || 30;
        const totalUsd = offerPriceUsd != null ? offerPriceUsd : amount / 3.75;
        const second = parseFloat((totalUsd * (1 - pct / 100)).toFixed(2));
        const { data, error } = await supabase
          .from('requests')
          .update({ status: 'paid', payment_pct: pct, payment_second: second })
          .eq('id', requestId);
        console.log('[PaymentScreen] requests.update offer→paid:', data, error);
      } else if (type === 'sample' && sampleId) {
        const { data, error } = await supabase
          .from('samples')
          .update({ status: 'paid' })
          .eq('id', sampleId);
        console.log('[PaymentScreen] samples.update:', data, error);
      }

      // ── 2. Resolve supplierId if not provided ───────────────────────
      if (!resolvedSupplierId && resolvedRequestId) {
        const { data: ao } = await supabase
          .from('offers')
          .select('supplier_id')
          .eq('request_id', resolvedRequestId)
          .eq('status', 'accepted')
          .maybeSingle();
        console.log('[PaymentScreen] offer lookup for supplierId:', ao);
        resolvedSupplierId = ao?.supplier_id || null;
      }

      // ── 2b. Notify the supplier when the buyer pays the 2nd installment ──
      if (type === 'second_installment' && resolvedSupplierId && resolvedRequestId) {
        await supabase.from('notifications').insert({
          user_id: resolvedSupplierId,
          type: 'second_payment_received',
          title_ar: 'تمت الدفعة الثانية — قم بالشحن وأضف رقم التتبع',
          title_en: 'Second installment paid — please ship and add the tracking number',
          title_zh: '尾款已付款 — 请发货并添加追踪号',
          ref_id: resolvedRequestId,
          is_read: false,
        });
      }

      // ── 3. Insert payments row ──────────────────────────────────────
      if (user && moyasarId) {
        const totalUsd = offerPriceUsd != null ? offerPriceUsd : amount / 3.75;
        const pct = paymentPct || (type === 'sample' ? 100 : 30);
        let paymentRow;

        if (type === 'second_installment') {
          paymentRow = {
            request_id: resolvedRequestId || null,
            buyer_id: user.id,
            supplier_id: resolvedSupplierId,
            amount: totalUsd,
            amount_first: 0,
            amount_second: totalUsd,
            payment_pct: pct,
            maabar_fee: 0,
            supplier_amount: parseFloat((totalUsd * 0.96).toFixed(2)),
            status: 'second_paid',
            moyasar_id: moyasarId,
          };
        } else if (type === 'sample') {
          paymentRow = {
            request_id: null,
            buyer_id: user.id,
            supplier_id: resolvedSupplierId,
            amount: totalUsd,
            amount_first: totalUsd,
            amount_second: 0,
            payment_pct: 100,
            maabar_fee: 0,
            supplier_amount: 0,
            status: 'first_paid',
            moyasar_id: moyasarId,
          };
        } else {
          // checkout (new or existing) and offer — first installment
          const amountFirst = parseFloat((totalUsd * pct / 100).toFixed(2));
          const amountSecond = parseFloat((totalUsd - amountFirst).toFixed(2));
          paymentRow = {
            request_id: resolvedRequestId || null,
            buyer_id: user.id,
            supplier_id: resolvedSupplierId,
            amount: totalUsd,
            amount_first: amountFirst,
            amount_second: amountSecond,
            payment_pct: pct,
            maabar_fee: 0,
            supplier_amount: parseFloat((totalUsd * 0.96).toFixed(2)),
            status: 'first_paid',
            moyasar_id: moyasarId,
          };
        }

        const { data: pd, error: pe } = await supabase
          .from('payments')
          .insert(paymentRow)
          .select('id')
          .single();
        console.log('[PaymentScreen] payments.insert:', pd, pe);

        if (pd?.id && resolvedRequestId && type !== 'sample') {
          await supabase.from('requests').update({ payment_id: pd.id }).eq('id', resolvedRequestId);
          console.log('[PaymentScreen] requests.payment_id updated:', pd.id);
        }

        // ── 4. Direct Purchase: full-payment notification + emails ────
        // Mirrors web src/pages/PaymentSuccess.jsx isDirect branch. Detects
        // direct purchase via the isDirect route param (passed from
        // BuyerDirectOrdersScreen.payDirectOrder). RFQ paths are unaffected.
        if (isDirect && resolvedRequestId && resolvedSupplierId) {
          // Fetch the request title fields for email context.
          const titleRes = await supabase
            .from('requests')
            .select('title_ar, title_en, title_zh')
            .eq('id', resolvedRequestId)
            .maybeSingle();
          console.log('[PaymentScreen] direct title lookup response:', titleRes);
          const reqTitle = titleRes.data?.title_ar
            || titleRes.data?.title_en
            || titleRes.data?.title_zh
            || '';

          const lang = getLang();
          const sarLabel = lang === 'ar' ? 'ر.س' : 'SAR';
          const amountStr = fmtSAR(amount);

          // Supplier in-app notification — full-payment wording (web Q4 string).
          const notifRes = await supabase.from('notifications').insert({
            user_id: resolvedSupplierId,
            type: 'payment_received',
            title_ar: `تم استلام الدفع كاملاً — ${amountStr} ر.س. ابدأ التجهيز الآن`,
            title_en: `Full payment received — ${amountStr} SAR. Start preparation now`,
            title_zh: `已收到全额付款 — ${amountStr} SAR. 立即开始备货`,
            ref_id: resolvedRequestId,
            is_read: false,
          }).select().single();
          console.log('[PaymentScreen] direct payment_received notification response:', notifRes);

          // Supplier email — direct_order_paid_supplier (already deployed).
          // The template hardcodes USD in its body, mirroring the web
          // payment_received_supplier template — so we pass totalUsd here.
          try {
            const r = await fetch(SEND_EMAIL_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
              body: JSON.stringify({
                type: 'direct_order_paid_supplier',
                data: {
                  recipientUserId: resolvedSupplierId,
                  requestTitle: reqTitle,
                  amount: totalUsd,
                  paidAt: new Date().toISOString(),
                },
              }),
            });
            const body = await r.json().catch(() => null);
            console.log('[PaymentScreen] direct_order_paid_supplier email response:', { status: r.status, body });
          } catch (emailError) {
            console.error('[PaymentScreen] direct_order_paid_supplier email error:', emailError);
          }

          // Buyer email — direct_order_paid_buyer (already deployed).
          // The template hardcodes SAR in its body — pass the SAR amount.
          if (user.email) {
            try {
              const r = await fetch(SEND_EMAIL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({
                  type: 'direct_order_paid_buyer',
                  to: user.email,
                  data: {
                    requestTitle: reqTitle,
                    amount,
                    paidAt: new Date().toISOString(),
                  },
                }),
              });
              const body = await r.json().catch(() => null);
              console.log('[PaymentScreen] direct_order_paid_buyer email response:', { status: r.status, body });
            } catch (emailError) {
              console.error('[PaymentScreen] direct_order_paid_buyer email error:', emailError);
            }
          }
        } else if (isDirect && (!resolvedRequestId || !resolvedSupplierId)) {
          console.warn('[PaymentScreen] direct purchase post-payment skipped — missing requestId or supplierId', { resolvedRequestId, resolvedSupplierId });
        }
      }
    } catch (e) {
      console.error('[PaymentScreen] runDbAction error:', e);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <View style={s.successCircle}>
            <Text style={s.successCheck}>✓</Text>
          </View>
          <Text style={s.successTitle}>{tx('تم الدفع بنجاح', 'Payment successful')}</Text>
          <TouchableOpacity
            style={s.successBtn}
            onPress={() => navigation.navigate('Requests')}
            activeOpacity={0.85}
          >
            <Text style={s.successBtnText}>{tx('عرض طلباتي', 'My Requests')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.back}>{tx('← رجوع', '← Back')}</Text>
          </TouchableOpacity>
          <Text style={s.title}>{tx('الدفع الآمن', 'Secure Payment')}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Amount display */}
          <View style={s.amountCard}>
            <Text style={s.amountLabel}>{tx('المبلغ المستحق', 'Amount Due')}</Text>
            <Text style={s.amountValue}>{fmtSAR(amount)} {tx('ر.س', 'SAR')}</Text>
          </View>

          {/* Card form */}
          <View style={s.formCard}>
            <Text style={s.formTitle}>{tx('بيانات البطاقة', 'Card Details')}</Text>

            <Field
              label={tx('اسم حامل البطاقة', 'Cardholder Name')}
              value={name}
              onChangeText={setName}
              placeholder={tx('الاسم كما يظهر على البطاقة', 'Name as on card')}
              autoCapitalize="words"
            />

            <Field
              label={tx('رقم البطاقة', 'Card Number')}
              value={card}
              onChangeText={v => setCard(formatCardNumber(v))}
              placeholder="0000 0000 0000 0000"
              keyboardType="numeric"
              maxLength={19}
            />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label={tx('تاريخ الانتهاء', 'Expiry')}
                  value={expiry}
                  onChangeText={v => setExpiry(formatExpiry(v))}
                  placeholder="MM/YY"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Field
                  label="CVV"
                  value={cvv}
                  onChangeText={v => setCvv(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="000"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Accepted cards note */}
          <View style={s.acceptedRow}>
            <Text style={s.acceptedText}>{tx('نقبل: مدى · Visa · Mastercard', 'Accepted: Mada · Visa · Mastercard')}</Text>
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.payBtn, loading && { opacity: 0.6 }]}
            onPress={handlePay}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.payBtnText}>{tx('ادفع الآن', 'Pay Now')} — {fmtSAR(amount)} {tx('ر.س', 'SAR')}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        placeholderTextColor={C.textDisabled}
        {...props}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgRaised,
  },
  back:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  title: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17 },

  scroll: { padding: 20, paddingBottom: 32, gap: 14 },

  amountCard: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 20,
    alignItems: 'center',
  },
  amountLabel: { color: C.textTertiary, fontFamily: F.ar, fontSize: 12, marginBottom: 6 },
  amountValue: { color: C.textPrimary, fontFamily: F.enLight, fontSize: 32, letterSpacing: -1 },

  formCard: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 18,
  },
  formTitle: {
    color: C.textTertiary,
    fontFamily: F.ar,
    fontSize: 11,
    textAlign: 'right',
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  row: { flexDirection: 'row' },

  fieldWrap:  { marginBottom: 14 },
  fieldLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: C.bgBase,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: F.en,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'right',
  },

  acceptedRow: { alignItems: 'center', paddingVertical: 4 },
  acceptedText: { color: C.textTertiary, fontFamily: F.ar, fontSize: 12 },

  errorBox: {
    backgroundColor: 'rgba(180,0,0,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180,0,0,0.18)',
    padding: 14,
  },
  errorText: { color: C.red, fontFamily: F.ar, fontSize: 13, textAlign: 'right' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.borderSubtle, backgroundColor: C.bgRaised },
  payBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 16 },

  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 2, borderColor: C.green,
  },
  successCheck: { fontSize: 36, color: C.green },
  successTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 22, marginBottom: 28 },
  successBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 16,
    paddingVertical: 15, paddingHorizontal: 40, alignItems: 'center',
  },
  successBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 16 },
});
