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
  title: 'أهلاً بك في مَعبر',
  sub: 'تسوّق من موردين صينيين موثوقين',
  email: 'البريد الإلكتروني',
  pass: 'كلمة المرور',
  signin: 'تسجيل الدخول',
  noAccount: 'ما عندك حساب؟',
  createBuyer: 'حساب تاجر',
  createSupplier: 'حساب مورد',
  wrongCreds: 'إيميل أو كلمة مرور غير صحيحة.',
  confirmEmail: 'يرجى تأكيد بريدك الإلكتروني أولاً.',
  orDivider: 'أو',
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    if (!email || !password) { setError(L.wrongCreds); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message.includes('confirm') ? L.confirmEmail : L.wrongCreds);
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.logoRow}>
            <MaabarLogo size="lg" />
          </View>

          <Text style={s.title}>{L.title}</Text>
          <Text style={s.sub}>{L.sub}</Text>

          <View style={s.card}>
            <Field label={L.email} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" />
            <Field label={L.pass} value={password} onChangeText={setPassword}
              secureTextEntry />

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.6 }]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{L.signin}</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{L.orDivider}</Text>
            <View style={s.dividerLine} />
          </View>

          <Text style={s.noAccount}>{L.noAccount}</Text>
          <View style={s.signupRow}>
            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => navigation.navigate('SignupBuyer')}
              activeOpacity={0.8}
            >
              <Text style={s.outlineBtnText}>{L.createBuyer}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => navigation.navigate('SignupSupplier')}
              activeOpacity={0.8}
            >
              <Text style={s.outlineBtnText}>{L.createSupplier}</Text>
            </TouchableOpacity>
          </View>

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
  scroll: { flexGrow: 1, padding: 24, paddingTop: 40 },
  logoRow: { alignItems: 'center', marginBottom: 32 },
  title: {
    color: C.textPrimary, fontSize: 26, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    color: C.textSecondary, fontSize: 14,
    textAlign: 'center', marginBottom: 32,
  },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: C.borderDefault, gap: 16,
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
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 24, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.borderMuted },
  dividerText: { color: C.textTertiary, fontSize: 12 },
  noAccount: {
    color: C.textSecondary, textAlign: 'center',
    fontSize: 14, marginBottom: 12,
  },
  signupRow: { flexDirection: 'row', gap: 12 },
  outlineBtn: {
    flex: 1, borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 14, paddingVertical: 13, alignItems: 'center',
    backgroundColor: C.bgRaised,
  },
  outlineBtnText: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
});
