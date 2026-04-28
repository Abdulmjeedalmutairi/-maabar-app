/**
 * GuestSignupModal
 * Shown at the last step of a form when the user is not logged in.
 * Handles sign-up, upserts the profile, then calls onSuccess(user).
 * The parent is responsible for the actual request insert after onSuccess.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getLang } from '../lib/lang';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';

export default function GuestSignupModal({ visible, onClose, onSuccess, navigation }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function reset() {
    setForm({ firstName: '', lastName: '', email: '', password: '' });
    setError('');
    setAwaitingConfirm(false);
    setLoading(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSignup() {
    const { firstName, lastName, email, password } = form;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('يرجى تعبئة جميع الحقول.'); return;
    }
    setLoading(true);
    setError('');

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const lang = getLang();
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName, role: 'buyer', lang } },
    });

    if (err) { setError(err.message); setLoading(false); return; }

    // Upsert profile regardless of session state
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.trim().toLowerCase(),
        full_name: fullName,
        role: 'buyer',
        lang,
      });
    }

    setLoading(false);

    if (data?.session) {
      // Immediately authenticated — auto-submit
      reset();
      onSuccess(data.user);
    } else {
      // Email confirmation required — let user know
      setAwaitingConfirm(true);
    }
  }

  function goLogin() {
    handleClose();
    if (navigation) navigation.navigate('Login');
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Text style={s.closeText}>إغلاق</Text>
            </TouchableOpacity>
          </View>

          {awaitingConfirm ? (
            <View style={s.confirmBox}>
              <Text style={s.confirmTitle}>تحقق من بريدك</Text>
              <Text style={s.confirmBody}>
                أرسلنا لك رسالة تأكيد. فعّل حسابك ثم سجّل دخولك لإرسال طلبك.
              </Text>
              <TouchableOpacity style={s.btn} onPress={goLogin}>
                <Text style={s.btnText}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.title}>سجّل حسابك لإرسال طلبك</Text>
              <Text style={s.subtitle}>حسابك مجاني ويستغرق ثوانٍ</Text>

              <View style={s.card}>
                <View style={s.row}>
                  <Field
                    label="الاسم الأول"
                    value={form.firstName}
                    onChangeText={v => set('firstName', v)}
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="الاسم الأخير"
                    value={form.lastName}
                    onChangeText={v => set('lastName', v)}
                    style={{ flex: 1 }}
                  />
                </View>
                <Field
                  label="البريد الإلكتروني"
                  value={form.email}
                  onChangeText={v => set('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Field
                  label="كلمة المرور"
                  value={form.password}
                  onChangeText={v => set('password', v)}
                  secureTextEntry
                />

                {!!error && <Text style={s.error}>{error}</Text>}

                <TouchableOpacity
                  style={[s.btn, loading && { opacity: 0.6 }]}
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={C.btnPrimaryText} />
                    : <Text style={s.btnText}>إنشاء الحساب وإرسال الطلب</Text>}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.loginRow} onPress={goLogin}>
                <Text style={s.loginLabel}>عندك حساب؟ </Text>
                <Text style={s.loginLink}>سجّل دخولك</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, style, ...props }) {
  return (
    <View style={[s.fieldWrap, style]}>
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
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 48 },

  header: { marginBottom: 24, alignItems: 'flex-start' },
  closeText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 15 },

  title: {
    color: C.textPrimary, fontFamily: F.arBold, fontSize: 22,
    textAlign: 'right', marginBottom: 6,
  },
  subtitle: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 13,
    textAlign: 'right', marginBottom: 24,
  },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 20,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 20, gap: 14,
  },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 12, textAlign: 'right',
  },
  input: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontFamily: F.ar, fontSize: 15, textAlign: 'right',
  },
  error: { color: C.red, fontFamily: F.ar, fontSize: 13, textAlign: 'right' },

  btn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 15 },

  loginRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 20,
  },
  loginLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  loginLink:  { color: C.textPrimary,   fontFamily: F.arBold, fontSize: 14 },

  confirmBox: { alignItems: 'center', paddingTop: 40, gap: 20 },
  confirmTitle: {
    color: C.textPrimary, fontFamily: F.arBold, fontSize: 22, textAlign: 'center',
  },
  confirmBody: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 14,
    textAlign: 'center', lineHeight: 22,
  },
});
