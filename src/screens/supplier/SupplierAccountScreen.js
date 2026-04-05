import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

const VERIFICATION_AR = {
  registered: 'مسجّل',
  verification_required: 'التحقق مطلوب',
  verification_under_review: 'قيد المراجعة',
  verified: 'موثّق ✓',
  rejected: 'مرفوض',
  inactive: 'غير نشط',
};

const VERIFICATION_COLOR = {
  registered: C.blue,
  verification_required: C.orange,
  verification_under_review: C.orange,
  verified: C.green,
  rejected: C.red,
  inactive: C.textDisabled,
};

export default function SupplierAccountScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyForm, setVerifyForm] = useState({
    regNumber: '', yearsExperience: '',
    payoutName: '', bankName: '', swiftCode: '', iban: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('company_name, email, country, city, whatsapp, wechat, trade_link, status, maabar_supplier_id, trust_score, years_experience, reg_number, created_at')
      .eq('id', user.id).single();
    setProfile(data);
    setLoading(false);
  }

  function setV(k, v) { setVerifyForm(f => ({ ...f, [k]: v })); }

  async function submitVerification() {
    if (!verifyForm.regNumber) { Alert.alert('', 'أدخل رقم السجل التجاري'); return; }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').update({
      reg_number: verifyForm.regNumber,
      years_experience: verifyForm.yearsExperience ? parseInt(verifyForm.yearsExperience) : null,
      payout_beneficiary_name: verifyForm.payoutName,
      bank_name: verifyForm.bankName,
      swift_code: verifyForm.swiftCode,
      payout_iban: verifyForm.iban,
      status: 'verification_under_review',
    }).eq('id', user.id);
    setSubmitting(false);
    setShowVerify(false);
    loadProfile();
    Alert.alert('✓', 'تم إرسال طلب التحقق بنجاح. سيراجعه فريق مَعبر خلال 3-5 أيام عمل.');
  }

  async function handleSignOut() {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  const status = profile?.status || 'registered';
  const statusColor = VERIFICATION_COLOR[status] || C.textDisabled;
  const statusLabel = VERIFICATION_AR[status] || status;
  const canSubmitVerification = ['registered', 'verification_required'].includes(status);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.profileHeader}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {profile?.company_name?.charAt(0)?.toUpperCase() || 'S'}
            </Text>
          </View>
          <Text style={s.companyName}>{profile?.company_name || '—'}</Text>
          {profile?.maabar_supplier_id && (
            <Text style={s.supplierId}>{profile.maabar_supplier_id}</Text>
          )}
          <View style={[s.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Verification CTA */}
        {canSubmitVerification && (
          <TouchableOpacity
            style={s.verifyBanner}
            onPress={() => setShowVerify(true)}
            activeOpacity={0.85}
          >
            <Text style={s.verifyBannerTitle}>أكمل التحقق لتفعيل حسابك</Text>
            <Text style={s.verifyBannerSub}>ارفع وثائق شركتك للبدء في استقبال الطلبات</Text>
          </TouchableOpacity>
        )}

        {/* Profile info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>بيانات الشركة</Text>
          <InfoRow label="البريد" value={profile?.email || '—'} />
          <InfoRow label="الدولة" value={profile?.country || '—'} />
          <InfoRow label="المدينة" value={profile?.city || '—'} />
          {profile?.whatsapp && <InfoRow label="واتساب" value={profile.whatsapp} />}
          {profile?.wechat && <InfoRow label="WeChat" value={profile.wechat} />}
          {profile?.trust_score !== null && (
            <InfoRow label="التقييم" value={`${profile.trust_score || 0} / 100`} />
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>معلومات</Text>
          <InfoRow
            label="تاريخ الانضمام"
            value={profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('ar-SA')
              : '—'}
          />
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={s.signOutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Verification Modal */}
      <Modal visible={showVerify} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setShowVerify(false)}>
                  <Text style={s.modalClose}>إغلاق</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>طلب التحقق</Text>
              </View>

              <Text style={s.verifyNote}>
                أدخل بيانات الشركة التجارية وتفاصيل الاستلام. السجل التجاري مطلوب — باقي الحقول اختيارية ولكن توفّر موثوقية أعلى.
              </Text>

              <VField label="رقم السجل التجاري *" value={verifyForm.regNumber}
                onChangeText={v => setV('regNumber', v)} />
              <VField label="سنوات الخبرة" value={verifyForm.yearsExperience}
                onChangeText={v => setV('yearsExperience', v)} keyboardType="numeric" />

              <Text style={s.sectionDivider}>بيانات الاستلام</Text>
              <VField label="اسم المستفيد" value={verifyForm.payoutName}
                onChangeText={v => setV('payoutName', v)} />
              <VField label="اسم البنك" value={verifyForm.bankName}
                onChangeText={v => setV('bankName', v)} />
              <VField label="SWIFT / BIC" value={verifyForm.swiftCode}
                onChangeText={v => setV('swiftCode', v)} autoCapitalize="characters" />
              <VField label="IBAN / رقم الحساب" value={verifyForm.iban}
                onChangeText={v => setV('iban', v)} autoCapitalize="characters" />

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitVerification}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>إرسال للمراجعة</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoValue}>{value}</Text>
      <Text style={s.infoLabel}>{label}</Text>
    </View>
  );
}

function VField({ label, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={C.textDisabled} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingBottom: 60 },

  profileHeader: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentMuted, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: C.accentStrong,
  },
  avatarText: { color: C.accent, fontSize: 30, fontWeight: '700' },
  companyName: { color: C.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  supplierId: { color: C.textDisabled, fontSize: 12, marginBottom: 10 },
  statusBadge: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, fontWeight: '700' },

  verifyBanner: {
    backgroundColor: C.accentSoft, borderRadius: 16,
    padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: C.accentMuted,
    alignItems: 'center',
  },
  verifyBannerTitle: { color: C.accent, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  verifyBannerSub: { color: C.textSecondary, fontSize: 13, textAlign: 'center' },

  section: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    marginBottom: 16, overflow: 'hidden',
  },
  sectionTitle: {
    color: C.textTertiary, fontSize: 11, fontWeight: '600',
    textAlign: 'right', padding: 14, paddingBottom: 8,
    letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoLabel: { color: C.textSecondary, fontSize: 14 },
  infoValue: { color: C.textPrimary, fontSize: 14, fontWeight: '500' },

  signOutBtn: {
    backgroundColor: C.redSoft, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: C.red + '40', marginTop: 8,
  },
  signOutText: { color: C.red, fontWeight: '700', fontSize: 16 },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: C.accent, fontSize: 15 },
  verifyNote: {
    color: C.textSecondary, fontSize: 13, textAlign: 'right',
    lineHeight: 20, marginBottom: 20,
    backgroundColor: C.bgRaised, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  sectionDivider: {
    color: C.textTertiary, fontSize: 12, textAlign: 'right',
    marginVertical: 12, fontWeight: '600',
  },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, textAlign: 'right',
  },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
