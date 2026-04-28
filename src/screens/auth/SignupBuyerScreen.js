import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import MaabarLogo from '../../components/MaabarLogo';

const L = {
  title: 'إنشاء حساب تاجر',
  sub: 'انضم لمنصة مَعبر واستورد من الصين',
  firstName: 'الاسم الأول',
  lastName: 'الاسم الأخير',
  email: 'البريد الإلكتروني',
  phone: 'رقم الجوال',
  city: 'المدينة',
  pass: 'كلمة المرور',
  signup: 'إنشاء الحساب',
  haveAccount: 'عندك حساب؟',
  signinLink: 'سجل دخولك',
  termsNote: 'بالتسجيل، أنت توافق على الشروط والأحكام',
  confirmSent: 'تم إرسال رسالة تأكيد على بريدك الإلكتروني. فعّل حسابك ثم سجّل دخولك.',
  fillRequired: 'يرجى تعبئة جميع الحقول.',
};

const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'تبوك', 'أبها', 'القصيم', 'حائل'];

export default function SignupBuyerScreen({ navigation }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', city: '', password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSignup() {
    const { firstName, lastName, email, phone, city, password } = form;
    if (!firstName || !lastName || !email || !password) {
      setError(L.fillRequired); return;
    }
    setLoading(true);
    setError('');

    const lang = getLang();
    const { data, error: signupErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`,
          phone,
          city,
          role: 'buyer',
          lang,
        },
      },
    });

    if (signupErr) { setError(signupErr.message); setLoading(false); return; }

    // Upsert profile
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.trim(),
        full_name: `${firstName} ${lastName}`,
        phone,
        city,
        role: 'buyer',
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

          <View style={s.card}>
            <View style={s.row}>
              <Field label={L.firstName} value={form.firstName}
                onChangeText={v => set('firstName', v)} style={{ flex: 1 }} />
              <Field label={L.lastName} value={form.lastName}
                onChangeText={v => set('lastName', v)} style={{ flex: 1 }} />
            </View>
            <Field label={L.email} value={form.email}
              onChangeText={v => set('email', v)}
              keyboardType="email-address" autoCapitalize="none" />
            <Field label={L.phone} value={form.phone}
              onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
            <Field label={L.pass} value={form.password}
              onChangeText={v => set('password', v)} secureTextEntry />

            {!!error && <Text style={s.error}>{error}</Text>}

            <Text style={s.termsNote}>{L.termsNote}</Text>

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.6 }]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{L.signup}</Text>}
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

function Field({ label, style, ...props }) {
  return (
    <View style={[s.fieldWrap, style]}>
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
  back: { marginBottom: 20 },
  backText: { color: C.accent, fontSize: 14 },
  logoRow: { alignItems: 'center', marginBottom: 24 },
  title: {
    color: C.textPrimary, fontSize: 24, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    color: C.textSecondary, fontSize: 13,
    textAlign: 'center', marginBottom: 24,
  },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: C.borderDefault, gap: 14,
  },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right' },
  input: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, textAlign: 'right',
  },
  error: { color: C.red, fontSize: 13, textAlign: 'right' },
  termsNote: { color: C.textTertiary, fontSize: 11, textAlign: 'center' },
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
