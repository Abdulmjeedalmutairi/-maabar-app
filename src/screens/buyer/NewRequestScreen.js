/**
 * NewRequestScreen
 * Standalone full-screen request form (no list).
 * Used for the guest flow (accessible pre-login from PublicHomeScreen).
 * Sign-up gate fires only on the final submit step.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { setupManagedRequest } from '../../lib/managedBrief';
import { buildTranslatedRequestFields } from '../../lib/requestTranslation';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import GuestSignupModal from '../../components/GuestSignupModal';
import {
  DISPLAY_CURRENCIES,
  normalizeDisplayCurrency,
  useDisplayCurrency,
} from '../../lib/displayCurrency';

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
  budgetCurrency: 'SAR',
  paymentPlan: '30',
  sampleReq: 'preferred',
};

export default function NewRequestScreen({ navigation, route }) {
  const mode         = route.params?.mode || 'direct';
  const prefillTitle = route.params?.prefillTitle || '';
  const isManaged    = mode === 'managed';
  const { displayCurrency: viewerCurrency } = useDisplayCurrency();

  const [form, setForm]           = useState({ ...EMPTY_FORM, titleAr: prefillTitle, budgetCurrency: viewerCurrency });

  // Track viewer currency until the buyer hasn't typed an amount yet.
  useEffect(() => {
    setForm(prev => prev.budgetPerUnit ? prev : { ...prev, budgetCurrency: viewerCurrency });
  }, [viewerCurrency]);
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

    const titleInput = form.titleAr.trim();
    const description = form.description.trim();
    const lang = getLang();

    // Translate title and description to all 3 languages at write time so
    // suppliers viewing in their own language see translated content.
    // form.titleAr holds whatever the buyer typed — its actual language is
    // `lang`. Per platform policy, traders use ar or en; route to the right slot.
    let translated = {};
    try {
      translated = await buildTranslatedRequestFields({
        titleAr: lang === 'ar' ? titleInput : '',
        titleEn: lang === 'en' ? titleInput : '',
        description,
        lang,
      });
    } catch (translationErr) {
      console.error('[NewRequestScreen] buildTranslatedRequestFields threw:', translationErr?.message || translationErr);
      translated = {
        title_ar: titleInput, title_en: titleInput, title_zh: titleInput,
        description_ar: description, description_en: description, description_zh: description,
      };
    }

    const payload = {
      buyer_id:           userId,
      title_ar:           translated.title_ar || titleInput,
      title_en:           translated.title_en || titleInput,
      title_zh:           translated.title_zh || titleInput,
      description:        description,
      description_ar:     translated.description_ar || null,
      description_en:     translated.description_en || null,
      description_zh:     translated.description_zh || null,
      quantity:           parseInt(form.quantity, 10),
      category:           form.category || 'other',
      budget_per_unit:    form.budgetPerUnit ? parseFloat(form.budgetPerUnit) : null,
      budget_currency:    form.budgetPerUnit ? normalizeDisplayCurrency(form.budgetCurrency || viewerCurrency) : null,
      payment_plan:       parseInt(form.paymentPlan, 10),
      sample_requirement: form.sampleReq,
      status:             'open',
      sourcing_mode:      isManaged ? 'managed' : 'direct',
      managed_status:     isManaged ? 'submitted' : null,
    };
    const { data: inserted, error } = await supabase.from('requests').insert(payload).select('id').single();
    if (error) { setSubmitting(false); setFormError('حدث خطأ، حاول مرة أخرى.'); return; }

    // For managed requests: generate the AI brief and advance to admin_review
    // so the admin concierge queue has an AI summary to work with.
    if (isManaged && inserted?.id) {
      await setupManagedRequest({ requestId: inserted.id, buyerId: userId, requestPayload: payload, lang: getLang() });
    }

    setSubmitting(false);

    const lang = getLang();
    const successTitle =
      lang === 'ar' ? 'تم رفع طلبك'
      : lang === 'zh' ? '需求已发布'
      : 'Request posted';
    const successBody = isManaged
      ? (lang === 'ar' ? 'سيقوم فريق معبر بمراجعة الطلب وعرض أفضل 3 خيارات.'
        : lang === 'zh' ? 'Maabar 团队会审核您的需求，并展示最佳 3 个方案。'
        : 'The Maabar team will review your request and present the top 3 options.')
      : (lang === 'ar' ? 'سيتواصل معك الموردون قريباً.'
        : lang === 'zh' ? '供应商会尽快联系您。'
        : 'Suppliers will contact you soon.');
    const okLabel = lang === 'ar' ? 'حسناً' : lang === 'zh' ? '好的' : 'OK';

    // RootNavigator will detect auth state and switch to BuyerTabs automatically.
    // If already in BuyerTabs (logged-in user reached this screen), navigate back.
    Alert.alert(successTitle, successBody, [{
      text: okLabel,
      onPress: () => {
        try {
          if (isManaged && inserted?.id) {
            navigation.navigate('ManagedRequest', { requestId: inserted.id, title: payload.title_ar });
          } else {
            navigation.navigate('Requests');
          }
        } catch {}
      },
    }]);
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
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>الميزانية للوحدة (اختياري)</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholderTextColor={C.textDisabled}
                textAlign="right"
                keyboardType="numeric"
                value={form.budgetPerUnit}
                onChangeText={v => setField('budgetPerUnit', v)}
              />
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {DISPLAY_CURRENCIES.map(cur => {
                  const active = form.budgetCurrency === cur;
                  return (
                    <TouchableOpacity key={cur}
                      style={[s.chip, active && s.chipActive, { paddingHorizontal: 10 }]}
                      onPress={() => setField('budgetCurrency', cur)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{cur}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

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
