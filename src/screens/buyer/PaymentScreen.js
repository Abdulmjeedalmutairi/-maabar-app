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
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';

const MOYASAR_API = 'https://api.moyasar.com/v1/payments';
const MOYASAR_KEY = 'pk_test_gYDMsvJ8sAetQWtBXfzGPMz6B1kiu38TJYTJu5Rn';

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
      await runDbAction();
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
        await runDbAction();
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

  async function runDbAction() {
    try {
      if (type === 'checkout' && requestData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('requests').insert({ ...requestData, buyer_id: user.id, status: 'open' });
        }
      } else if (type === 'second_installment' && requestId) {
        await supabase.from('requests').update({ status: 'shipping' }).eq('id', requestId);
      } else if (type === 'offer' && offerId && requestId) {
        await supabase.from('offers').update({ status: 'accepted' }).eq('id', offerId);
        await supabase.from('requests').update({ status: 'closed' }).eq('id', requestId);
      } else if (type === 'sample' && sampleId) {
        await supabase.from('samples').update({ status: 'paid' }).eq('id', sampleId);
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
            <Text style={s.amountValue}>{amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} {tx('ر.س', 'SAR')}</Text>
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
              : <Text style={s.payBtnText}>{tx('ادفع الآن', 'Pay Now')} — {amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} {tx('ر.س', 'SAR')}</Text>
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
        color={C.textPrimary}
        textAlign="right"
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
