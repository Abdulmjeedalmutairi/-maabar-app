/**
 * NewRequestScreen
 * Standalone full-screen request form (no list).
 * Used for the guest flow (accessible pre-login from PublicHomeScreen).
 * Sign-up gate fires only on the final submit step.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import GuestSignupModal from '../../components/GuestSignupModal';

const CATEGORIES = [
  { val: 'electronics', label: 'إلكترونيات' },
  { val: 'furniture',   label: 'أثاث' },
  { val: 'clothing',    label: 'ملابس' },
  { val: 'building',    label: 'مواد بناء' },
  { val: 'food',        label: 'غذاء' },
  { val: 'other',       label: 'أخرى' },
];

const PAYMENT_PLANS = [
  { val: '30',  label: '30% مقدماً' },
  { val: '50',  label: '50% مقدماً' },
  { val: '100', label: '100% مقدماً' },
];

const SAMPLE_REQS = [
  { val: 'none',      label: 'لا حاجة لعينة' },
  { val: 'preferred', label: 'عينة مفضلة' },
  { val: 'required',  label: 'عينة إلزامية' },
];

const EMPTY_FORM = {
  titleAr: '',
  description: '',
  quantity: '',
  category: 'other',
  budgetPerUnit: '',
  paymentPlan: '30',
  sampleReq: 'preferred',
};

export default function NewRequestScreen({ navigation, route }) {
  const mode         = route.params?.mode || 'direct';
  const prefillTitle = route.params?.prefillTitle || '';
  const isManaged    = mode === 'managed';

  const [form, setForm]           = useState({ ...EMPTY_FORM, titleAr: prefillTitle });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]  = useState('');
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      console.log('[NewRequest] mount — user?.id:', user?.id ?? 'null (not authenticated)');
    });
  }, []);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function validate() {
    if (!form.titleAr.trim())  { setFormError('يرجى إدخال عنوان الطلب.'); return false; }
    if (!form.quantity.trim()) { setFormError('يرجى إدخال الكمية المطلوبة.'); return false; }
    if (!form.paymentPlan)     { setFormError('يرجى اختيار خطة الدفع.'); return false; }
    if (!form.sampleReq)       { setFormError('يرجى اختيار متطلبات العينة.'); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;

    const { data: { user } } = await supabase.auth.getUser();
    console.log('[NewRequest] handleSubmit — user?.id:', user?.id ?? 'null');
    if (!user) {
      setShowSignup(true);
      return;
    }
    await doInsert(user.id);
  }

  async function doInsert(userId) {
    setSubmitting(true);
    setFormError('');
    const { error } = await supabase.from('requests').insert({
      buyer_id:           userId,
      title_ar:           form.titleAr.trim(),
      title_en:           form.titleAr.trim(),
      title_zh:           form.titleAr.trim(),
      description:        form.description.trim(),
      quantity:           form.quantity.trim(),
      category:           form.category || 'other',
      budget_per_unit:    form.budgetPerUnit ? parseFloat(form.budgetPerUnit) : null,
      payment_plan:       parseInt(form.paymentPlan, 10),
      sample_requirement: form.sampleReq,
      status:             'open',
      sourcing_mode:      isManaged ? 'managed' : 'direct',
      managed_status:     isManaged ? 'submitted' : null,
    });
    setSubmitting(false);
    if (error) { setFormError('حدث خطأ، حاول مرة أخرى.'); return; }
    // RootNavigator will detect auth state and switch to BuyerTabs automatically.
    // If already in BuyerTabs (logged-in user reached this screen), navigate back.
    try { navigation.navigate('Requests'); } catch {}
  }

  // Called after guest successfully signs up
  async function handleSignupSuccess(user) {
    setShowSignup(false);
    await doInsert(user.id);
    // RootNavigator switches to BuyerTabs via onAuthStateChange automatically
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={s.backText}>← رجوع</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>{isManaged ? 'الطلب المُدار' : 'ارفع طلبك'}</Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isManaged && (
            <View style={s.managedBanner}>
              <Text style={s.managedBannerText}>
                معبر سيتولى البحث ويعرض لك أفضل 3 خيارات من موردين مختارين.
              </Text>
            </View>
          )}

          <Field label="عنوان الطلب *" value={form.titleAr}
            onChangeText={v => setField('titleAr', v)} />
          <Field label="الوصف والمواصفات" value={form.description}
            onChangeText={v => setField('description', v)}
            multiline numberOfLines={4} style={{ minHeight: 100 }} />
          <Field label="الكمية المطلوبة *" value={form.quantity}
            onChangeText={v => setField('quantity', v)} />
          <Field label="الميزانية للوحدة (اختياري)" value={form.budgetPerUnit}
            onChangeText={v => setField('budgetPerUnit', v)} keyboardType="numeric" />

          <ChipRow
            label="الفئة"
            options={CATEGORIES}
            selected={form.category}
            onSelect={v => setField('category', v)}
          />
          <ChipRow
            label="خطة الدفع *"
            options={PAYMENT_PLANS}
            selected={form.paymentPlan}
            onSelect={v => setField('paymentPlan', v)}
          />
          <ChipRow
            label="متطلبات العينة *"
            options={SAMPLE_REQS}
            selected={form.sampleReq}
            onSelect={v => setField('sampleReq', v)}
          />

          {!!formError && <Text style={s.error}>{formError}</Text>}

          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={C.btnPrimaryText} />
              : <Text style={s.submitBtnText}>
                  {isManaged ? 'إرسال الطلب المُدار' : 'رفع الطلب'}
                </Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <GuestSignupModal
        visible={showSignup}
        onClose={() => setShowSignup(false)}
        onSuccess={handleSignupSuccess}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function Field({ label, style, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, style]}
        placeholderTextColor={C.textDisabled}
        textAlign="right"
        textAlignVertical={props.multiline ? 'top' : 'center'}
        {...props}
      />
    </View>
  );
}

function ChipRow({ label, options, selected, onSelect }) {
  return (
    <View style={s.chipSection}>
      <Text style={s.chipLabel}>{label}</Text>
      <View style={s.chipRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.val}
            style={[s.chip, selected === opt.val && s.chipActive]}
            onPress={() => onSelect(opt.val)}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, selected === opt.val && s.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ── Styles ── */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 18 },
  backText:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },

  scroll: { padding: 20, paddingBottom: 60 },

  managedBanner: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 14, marginBottom: 20,
  },
  managedBannerText: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 13,
    textAlign: 'right', lineHeight: 20,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 12,
    textAlign: 'right', marginBottom: 6,
  },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: F.ar, fontSize: 15,
    color: C.textPrimary, textAlign: 'right',
  },

  chipSection: { marginBottom: 18 },
  chipLabel: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 12,
    textAlign: 'right', marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  chip: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.bgRaised,
  },
  chipActive:     { borderColor: C.btnPrimary, backgroundColor: C.btnPrimary },
  chipText:       { color: C.textSecondary, fontFamily: F.ar, fontSize: 13 },
  chipTextActive: { color: C.btnPrimaryText, fontFamily: F.arSemi },

  error: {
    color: C.red, fontFamily: F.ar, fontSize: 13,
    textAlign: 'right', marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 16 },
});
