import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import MaabarLogo from '../../components/MaabarLogo';

const L = {
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
  hint: 'الحقول المعلّمة بـ * مطلوبة. السجل التجاري والوثائق تُطلب في مرحلة التحقق لاحقاً.',
  confirmSent: 'تم استلام طلب المورد. أرسلنا رسالة تأكيد — بعد التفعيل سجّل دخولك لإكمال التحقق.',
  fillRequired: 'يرجى تعبئة الحقول الإجبارية.',
};

export default function SignupSupplierScreen({ navigation }) {
  const [form, setForm] = useState({
    companyName: '', email: '', password: '',
    country: 'China', city: '',
    whatsapp: '', wechat: '', tradeLink: '', speciality: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit() {
    const { companyName, email, password } = form;
    if (!companyName || !email || !password) {
      setError(L.fillRequired); return;
    }
    setLoading(true);
    setError('');

    const { data, error: signupErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { company_name: companyName, role: 'supplier' },
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
            <Text style={s.btnText}>العودة لتسجيل الدخول</Text>
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
            <Text style={s.backText}>← رجوع</Text>
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

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.6 }]}
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
    textAlign: 'right', marginBottom: 20,
    backgroundColor: C.bgRaised, padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderSubtle,
  },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: C.borderDefault, gap: 14,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, textAlign: 'right',
  },
  error: { color: C.red, fontSize: 13, textAlign: 'right' },
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
