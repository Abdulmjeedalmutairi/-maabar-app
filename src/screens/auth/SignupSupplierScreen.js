import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import MaabarLogo from '../../components/MaabarLogo';

const TERMS_URL = 'https://maabar.io/terms';

const ALL_COPY = {
  ar: {
    title: 'طلب انضمام المورد',
    sub: 'أدخل بيانات الشركة الأساسية وأكّد بريدك الإلكتروني',
    companyName: 'اسم الشركة',
    email: 'البريد الإلكتروني',
    pass: 'كلمة المرور',
    country: 'الدولة',
    city: 'المدينة',
    whatsapp: 'واتساب (اختياري)',
    wechat: 'WeChat (اختياري)',
    tradeLink: 'رابط الصفحة التجارية (Alibaba / 1688 ...)',
    speciality: 'التخصص (اختياري)',
    submit: 'إرسال الطلب',
    haveAccount: 'عندك حساب؟',
    signinLink: 'سجل دخولك',
    backToSignin: 'العودة لتسجيل الدخول',
    back: '← رجوع',
    hint: 'الحقول المعلّمة بـ * مطلوبة. السجل التجاري والوثائق تُطلب في مرحلة التحقق لاحقاً.',
    confirmSent: 'تم استلام طلب المورد. أرسلنا رسالة تأكيد — بعد التفعيل سجّل دخولك لإكمال التحقق.',
    fillRequired: 'يرجى تعبئة الحقول الإجبارية.',
    termsAgree: 'أوافق على الشروط والأحكام',
    viewTerms: 'عرض الشروط',
    mustAgreeTerms: 'يجب الموافقة على الشروط والأحكام قبل المتابعة.',
  },
  en: {
    title: 'Supplier Application',
    sub: 'Enter your basic company details and confirm your email',
    companyName: 'Company Name',
    email: 'Email',
    pass: 'Password',
    country: 'Country',
    city: 'City',
    whatsapp: 'WhatsApp (optional)',
    wechat: 'WeChat (optional)',
    tradeLink: 'Trade page link (Alibaba / 1688 ...)',
    speciality: 'Specialty (optional)',
    submit: 'Submit Application',
    haveAccount: 'Already have an account?',
    signinLink: 'Sign in',
    backToSignin: 'Back to Sign In',
    back: '← Back',
    hint: 'Fields marked * are required. Registration documents are requested at the verification stage later.',
    confirmSent: 'Supplier application received. We sent a confirmation email — after activation sign in to complete verification.',
    fillRequired: 'Please fill all required fields.',
    termsAgree: 'I agree to the Terms & Conditions',
    viewTerms: 'View Terms',
    mustAgreeTerms: 'You must agree to the Terms & Conditions before continuing.',
  },
  zh: {
    title: '供应商申请',
    sub: '填写基础公司资料并确认邮箱',
    companyName: '公司名称',
    email: '电子邮件',
    pass: '密码',
    country: '国家',
    city: '城市',
    whatsapp: 'WhatsApp（可选）',
    wechat: 'WeChat（可选）',
    tradeLink: '贸易页面链接（Alibaba / 1688 ...）',
    speciality: '专业领域（可选）',
    submit: '提交申请',
    haveAccount: '已有账户？',
    signinLink: '登录',
    backToSignin: '返回登录',
    back: '← 返回',
    hint: '带 * 的字段为必填。营业执照和相关文件将在后续认证阶段提交。',
    confirmSent: '供应商申请已收到，确认邮件已发送 — 激活后登录继续完成认证。',
    fillRequired: '请填写必填项。',
    termsAgree: '我同意条款与条件',
    viewTerms: '查看条款',
    mustAgreeTerms: '继续前请先同意条款与条件。',
  },
};

export default function SignupSupplierScreen({ navigation }) {
  const lang = getLang();
  const L = ALL_COPY[lang] || ALL_COPY.ar;
  const isAr = lang === 'ar';

  const [form, setForm] = useState({
    companyName: '', email: '', password: '',
    country: 'China', city: '',
    whatsapp: '', wechat: '', tradeLink: '', speciality: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit() {
    const { companyName, email, password } = form;
    if (!companyName || !email || !password) {
      setError(L.fillRequired); return;
    }
    if (!agreedTerms) {
      setError(L.mustAgreeTerms); return;
    }
    setLoading(true);
    setError('');

    const lang = getLang();
    const { data, error: signupErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { company_name: companyName, role: 'supplier', lang },
      },
    });

    if (signupErr) { setError(signupErr.message); setLoading(false); return; }

    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.trim(),
        company_name: companyName,
        country: form.country,
        city: form.city,
        whatsapp: form.whatsapp,
        wechat: form.wechat,
        trade_link: form.tradeLink,
        speciality: form.speciality,
        role: 'supplier',
        status: 'registered',
        lang,
      });
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <MaabarLogo size="lg" />
          <Text style={s.successText}>{L.confirmSent}</Text>
          <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
            <Text style={s.btnText}>{L.backToSignin}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>{L.back}</Text>
          </TouchableOpacity>

          <View style={s.logoRow}><MaabarLogo size="lg" /></View>
          <Text style={s.title}>{L.title}</Text>
          <Text style={s.sub}>{L.sub}</Text>
          <Text style={s.hint}>{L.hint}</Text>

          <View style={s.card}>
            <Field label={`${L.companyName} *`} value={form.companyName}
              onChangeText={v => set('companyName', v)} />
            <Field label={`${L.email} *`} value={form.email}
              onChangeText={v => set('email', v)}
              keyboardType="email-address" autoCapitalize="none" />
            <Field label={`${L.pass} *`} value={form.password}
              onChangeText={v => set('password', v)} secureTextEntry />
            <Field label={L.country} value={form.country}
              onChangeText={v => set('country', v)} />
            <Field label={L.city} value={form.city}
              onChangeText={v => set('city', v)} />
            <Field label={L.whatsapp} value={form.whatsapp}
              onChangeText={v => set('whatsapp', v)} keyboardType="phone-pad" />
            <Field label={L.wechat} value={form.wechat}
              onChangeText={v => set('wechat', v)} />
            <Field label={L.tradeLink} value={form.tradeLink}
              onChangeText={v => set('tradeLink', v)}
              autoCapitalize="none" keyboardType="url" />
            <Field label={L.speciality} value={form.speciality}
              onChangeText={v => set('speciality', v)} />

            {/* T&C agreement gate */}
            <View style={s.termsRow}>
              <TouchableOpacity
                style={s.termsCheckbox}
                onPress={() => setAgreedTerms((v) => !v)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <View style={[s.checkboxBox, agreedTerms && s.checkboxBoxChecked]}>
                  {agreedTerms && <Text style={s.checkboxCheck}>✓</Text>}
                </View>
                <Text style={s.termsText}>{L.termsAgree}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL(TERMS_URL)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={s.termsLink}>{L.viewTerms} ↗</Text>
              </TouchableOpacity>
            </View>

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity
              style={[s.btn, (loading || !agreedTerms) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{L.submit}</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={s.switchRow}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={s.switchText}>{L.haveAccount} </Text>
            <Text style={[s.switchText, { color: C.accent }]}>{L.signinLink}</Text>
          </TouchableOpacity>

        </ScrollView>
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
  scroll: { flexGrow: 1, padding: 24, paddingTop: 20 },
  back: { marginBottom: 16 },
  backText: { color: C.accent, fontSize: 14 },
  logoRow: { alignItems: 'center', marginBottom: 20 },
  title: {
    color: C.textPrimary, fontSize: 24, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    color: C.textSecondary, fontSize: 13,
    textAlign: 'center', marginBottom: 8,
  },
  hint: {
    color: C.textTertiary, fontSize: 12,
    marginBottom: 20,
    backgroundColor: C.bgRaised, padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderSubtle,
  },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: C.borderDefault, gap: 14,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: C.textSecondary, fontSize: 12 },
  input: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15,
  },
  error: { color: C.red, fontSize: 13 },
  termsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8,
    marginTop: 4, marginBottom: 4,
  },
  termsCheckbox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    flex: 1, minWidth: 0,
  },
  checkboxBox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.borderStrong,
    backgroundColor: C.bgOverlay,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: C.accent, borderColor: C.accent,
  },
  checkboxCheck: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 14 },
  termsText: { color: C.textPrimary, fontSize: 13, flexShrink: 1 },
  termsLink: { color: C.accent, fontSize: 13, textDecorationLine: 'underline' },
  btn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'center',
    marginTop: 20, flexWrap: 'wrap',
  },
  switchText: { color: C.textSecondary, fontSize: 14 },
  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24,
  },
  successText: {
    color: C.textPrimary, fontSize: 15, textAlign: 'center', lineHeight: 24,
  },
});
