import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const COPY = {
  ar: {
    title: 'حسابي',
    editProfile: 'تعديل الملف الشخصي',
    editTitle: 'تعديل البيانات',
    saveChanges: 'حفظ التغييرات',
    companyName: 'اسم الشركة',
    errorSave: 'حدث خطأ أثناء الحفظ',
    saved: 'تم حفظ التغييرات',
    companyData: 'بيانات الشركة',
    email: 'البريد الإلكتروني',
    country: 'الدولة',
    city: 'المدينة',
    whatsapp: 'واتساب',
    wechat: 'WeChat',
    trustScore: 'التقييم',
    info: 'معلومات',
    joinDate: 'تاريخ الانضمام',
    stats: 'إحصائيات',
    statOffers: 'العروض المقدمة',
    statProducts: 'المنتجات',
    statAcceptRate: 'نسبة القبول',
    statTotalSales: 'إجمالي المبيعات (USD)',
    quickActions: 'إجراءات سريعة',
    qaOpenRequests: 'طلبات المشترين المفتوحة',
    qaMyProducts: 'منتجاتي',
    qaAddProduct: 'إضافة منتج جديد',
    signOut: 'تسجيل الخروج',
    signOutConfirm: 'هل أنت متأكد؟',
    signOutCancel: 'إلغاء',
    signOutAction: 'خروج',
    verifyBannerTitle: 'أكمل التحقق لتفعيل حسابك',
    verifyBannerSub: 'ارفع وثائق شركتك للبدء في استقبال الطلبات',
    verifyTitle: 'طلب التحقق',
    close: 'إغلاق',
    verifyNote: 'أدخل بيانات الشركة التجارية وتفاصيل الاستلام. السجل التجاري مطلوب — باقي الحقول اختيارية ولكن توفّر موثوقية أعلى.',
    regNumber: 'رقم السجل التجاري *',
    yearsExp: 'سنوات الخبرة',
    payoutSection: 'بيانات الاستلام',
    payoutName: 'اسم المستفيد',
    bankName: 'اسم البنك',
    swift: 'SWIFT / BIC',
    iban: 'IBAN / رقم الحساب',
    submitVerify: 'إرسال للمراجعة',
    verifySuccess: 'تم إرسال طلب التحقق بنجاح. سيراجعه فريق مَعبر خلال 3-5 أيام عمل.',
    errorReg: 'أدخل رقم السجل التجاري',
    errorGeneric: 'حدث خطأ، حاول مرة أخرى',
    verifyLabels: {
      registered: 'مسجّل',
      verification_required: 'التحقق مطلوب',
      verification_under_review: 'قيد المراجعة',
      verified: 'موثّق ✓',
      rejected: 'مرفوض',
      inactive: 'غير نشط',
    },
  },
  en: {
    title: 'My Account',
    editProfile: 'Edit Profile',
    editTitle: 'Edit Details',
    saveChanges: 'Save Changes',
    companyName: 'Company Name',
    errorSave: 'Failed to save changes',
    saved: 'Changes saved',
    companyData: 'Company Details',
    email: 'Email',
    country: 'Country',
    city: 'City',
    whatsapp: 'WhatsApp',
    wechat: 'WeChat',
    trustScore: 'Trust Score',
    info: 'Info',
    joinDate: 'Member Since',
    stats: 'Stats',
    statOffers: 'Offers Submitted',
    statProducts: 'Products',
    statAcceptRate: 'Accept Rate',
    statTotalSales: 'Total Sales (USD)',
    quickActions: 'Quick Actions',
    qaOpenRequests: 'Open Buyer Requests',
    qaMyProducts: 'My Products',
    qaAddProduct: 'Add New Product',
    signOut: 'Sign Out',
    signOutConfirm: 'Are you sure?',
    signOutCancel: 'Cancel',
    signOutAction: 'Sign Out',
    verifyBannerTitle: 'Complete verification to activate your account',
    verifyBannerSub: 'Upload your company documents to start receiving orders',
    verifyTitle: 'Verification Request',
    close: 'Close',
    verifyNote: 'Enter your business details and payout information. Company registration is required — other fields are optional but improve credibility.',
    regNumber: 'Company Registration Number *',
    yearsExp: 'Years of Experience',
    payoutSection: 'Payout Details',
    payoutName: 'Beneficiary Name',
    bankName: 'Bank Name',
    swift: 'SWIFT / BIC',
    iban: 'IBAN / Account Number',
    submitVerify: 'Submit for Review',
    verifySuccess: 'Verification request submitted. The Maabar team will review it within 3-5 business days.',
    errorReg: 'Enter your company registration number',
    errorGeneric: 'Something went wrong, please try again',
    verifyLabels: {
      registered: 'Registered',
      verification_required: 'Verification Required',
      verification_under_review: 'Under Review',
      verified: 'Verified ✓',
      rejected: 'Rejected',
      inactive: 'Inactive',
    },
  },
  zh: {
    title: '我的账户',
    editProfile: '编辑资料',
    editTitle: '编辑信息',
    saveChanges: '保存修改',
    companyName: '公司名称',
    errorSave: '保存失败，请重试',
    saved: '修改已保存',
    companyData: '公司信息',
    email: '电子邮件',
    country: '国家',
    city: '城市',
    whatsapp: 'WhatsApp',
    wechat: 'WeChat',
    trustScore: '信任评分',
    info: '信息',
    joinDate: '注册日期',
    stats: '统计',
    statOffers: '已提交报价',
    statProducts: '产品',
    statAcceptRate: '接受率',
    statTotalSales: '总销售额 (USD)',
    quickActions: '快捷操作',
    qaOpenRequests: '买家的开放需求',
    qaMyProducts: '我的产品',
    qaAddProduct: '添加新产品',
    signOut: '退出登录',
    signOutConfirm: '确认退出？',
    signOutCancel: '取消',
    signOutAction: '退出',
    verifyBannerTitle: '完成认证以激活账户',
    verifyBannerSub: '上传企业文件后即可开始接收订单',
    verifyTitle: '认证申请',
    close: '关闭',
    verifyNote: '请填写企业信息和收款资料。营业执照为必填项，其余字段为选填，但有助于提升可信度。',
    regNumber: '公司注册号 *',
    yearsExp: '从业年限',
    payoutSection: '收款资料',
    payoutName: '收款人姓名',
    bankName: '银行名称',
    swift: 'SWIFT / BIC',
    iban: 'IBAN / 银行账号',
    submitVerify: '提交审核',
    verifySuccess: '认证申请已提交，Maabar 团队将在 3-5 个工作日内完成审核。',
    errorReg: '请输入公司注册号',
    errorGeneric: '出现错误，请重试',
    verifyLabels: {
      registered: '已注册',
      verification_required: '需要认证',
      verification_under_review: '审核中',
      verified: '已认证 ✓',
      rejected: '已拒绝',
      inactive: '未激活',
    },
  },
};

const VERIFY_COLOR = {
  registered: C.blue,
  verification_required: C.orange,
  verification_under_review: C.orange,
  verified: C.green,
  rejected: C.red,
  inactive: C.textDisabled,
};

export default function SupplierAccountScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [profile, setProfile] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ offers: 0, products: 0, accepted: 0, totalSales: 0 });
  const [showVerify, setShowVerify] = useState(false);
  const [verifyForm, setVerifyForm] = useState({
    regNumber: '', yearsExperience: '',
    payoutName: '', bankName: '', swiftCode: '', iban: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ companyName: '', city: '', country: '', whatsapp: '', wechat: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email || '');

    // email lives in auth.users, not profiles — use select('*') like the web app
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) console.error('[SupplierAccount] loadProfile error:', error);

    console.log('[SupplierAccount] profile:', data);
    setProfile(data);
    if (data) {
      setEditForm({
        companyName: data.company_name || '',
        city: data.city || '',
        country: data.country || '',
        whatsapp: data.whatsapp || '',
        wechat: data.wechat || '',
      });
    }
    loadStats(user.id);
    setLoading(false);
  }

  async function loadStats(userId) {
    const [offersRes, productsRes, acceptedRes, paymentsRes] = await Promise.all([
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('supplier_id', userId),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('supplier_id', userId).eq('is_active', true),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('supplier_id', userId).eq('status', 'accepted'),
      supabase.from('payments').select('amount').eq('supplier_id', userId).eq('status', 'first_paid'),
    ]);
    const totalSales = (paymentsRes.data || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    setStats({
      offers: offersRes.count || 0,
      products: productsRes.count || 0,
      accepted: acceptedRes.count || 0,
      totalSales: Math.round(totalSales),
    });
  }

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      company_name: editForm.companyName || null,
      city: editForm.city || null,
      country: editForm.country || null,
      whatsapp: editForm.whatsapp || null,
      wechat: editForm.wechat || null,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { console.error('[SupplierAccount] saveProfile error:', error); Alert.alert('', t.errorSave); return; }
    setShowEdit(false);
    loadProfile();
    Alert.alert('✓', t.saved);
  }

  function setV(k, v) { setVerifyForm(f => ({ ...f, [k]: v })); }

  async function submitVerification() {
    if (!verifyForm.regNumber) { Alert.alert('', t.errorReg); return; }
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      reg_number: verifyForm.regNumber,
      years_experience: verifyForm.yearsExperience ? parseInt(verifyForm.yearsExperience, 10) : null,
      payout_beneficiary_name: verifyForm.payoutName || null,
      bank_name: verifyForm.bankName || null,
      swift_code: verifyForm.swiftCode || null,
      payout_iban: verifyForm.iban || null,
      status: 'verification_under_review',
    }).eq('id', user.id);

    setSubmitting(false);

    if (error) { console.error('[SupplierAccount] submitVerification error:', error); Alert.alert('', t.errorGeneric); return; }

    setShowVerify(false);
    loadProfile();
    Alert.alert('✓', t.verifySuccess);
  }

  function handleSignOut() {
    Alert.alert(t.signOut, t.signOutConfirm, [
      { text: t.signOutCancel, style: 'cancel' },
      { text: t.signOutAction, style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      </SafeAreaView>
    );
  }

  const status = profile?.status || 'registered';
  const statusColor = VERIFY_COLOR[status] || C.textDisabled;
  const statusLabel = (t.verifyLabels || {})[status] || status;
  const canVerify = ['registered', 'verification_required'].includes(status);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={s.profileHeader}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {profile?.company_name?.charAt(0)?.toUpperCase() || 'S'}
            </Text>
          </View>
          <Text style={[s.companyName, isAr && s.rtl]} numberOfLines={1}>
            {profile?.company_name || '—'}
          </Text>
          {profile?.maabar_supplier_id ? (
            <Text style={s.supplierId}>{profile.maabar_supplier_id}</Text>
          ) : null}
          <View style={[s.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <TouchableOpacity style={s.editProfileBtn} onPress={() => setShowEdit(true)} activeOpacity={0.85}>
            <Text style={s.editProfileText}>{t.editProfile}</Text>
          </TouchableOpacity>
        </View>

        {/* Verification CTA */}
        {canVerify && (
          <TouchableOpacity style={s.verifyBanner} onPress={() => setShowVerify(true)} activeOpacity={0.85}>
            <Text style={[s.verifyBannerTitle, isAr && s.rtl]}>{t.verifyBannerTitle}</Text>
            <Text style={[s.verifyBannerSub, isAr && s.rtl]}>{t.verifyBannerSub}</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <Text style={[s.blockHeader, isAr && s.rtl]}>{t.stats}</Text>
        <View style={s.statsGrid}>
          <StatTile label={t.statOffers} value={String(stats.offers)} />
          <StatTile label={t.statProducts} value={String(stats.products)} />
          <StatTile
            label={t.statAcceptRate}
            value={stats.offers > 0 ? `${Math.round((stats.accepted / stats.offers) * 100)}%` : '—'}
          />
          <StatTile
            label={t.statTotalSales}
            value={stats.totalSales ? stats.totalSales.toLocaleString() : '—'}
          />
        </View>

        {/* Quick Actions */}
        <Text style={[s.blockHeader, isAr && s.rtl]}>{t.quickActions}</Text>
        <View style={s.quickActions}>
          <TouchableOpacity
            style={[s.qaBtn, s.qaBtnPrimary]}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SRequests')}
          >
            <Text style={[s.qaText, s.qaTextPrimary, isAr && s.rtl]}>{t.qaOpenRequests}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.qaBtn}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SProducts')}
          >
            <Text style={[s.qaText, isAr && s.rtl]}>{t.qaMyProducts}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.qaBtn}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SProducts', { openAdd: true })}
          >
            <Text style={[s.qaText, isAr && s.rtl]}>{t.qaAddProduct}</Text>
          </TouchableOpacity>
        </View>

        {/* Company details */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, isAr && s.rtl]}>{t.companyData}</Text>
          <InfoRow label={t.email} value={userEmail || '—'} isAr={isAr} />
          <InfoRow label={t.country} value={profile?.country || '—'} isAr={isAr} />
          <InfoRow label={t.city} value={profile?.city || '—'} isAr={isAr} />
          {profile?.whatsapp ? <InfoRow label={t.whatsapp} value={profile.whatsapp} isAr={isAr} /> : null}
          {profile?.wechat ? <InfoRow label={t.wechat} value={profile.wechat} isAr={isAr} /> : null}
          {profile?.trust_score != null ? (
            <InfoRow label={t.trustScore} value={`${profile.trust_score || 0} / 100`} isAr={isAr} />
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, isAr && s.rtl]}>{t.info}</Text>
          <InfoRow
            label={t.joinDate}
            value={profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-GB')
              : '—'}
            isAr={isAr}
          />
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={s.signOutText}>{t.signOut}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEdit(false)}>
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => setShowEdit(false)}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.editTitle}</Text>
              </View>
              <VField label={t.companyName} value={editForm.companyName} onChangeText={v => setEditForm(f => ({ ...f, companyName: v }))} isAr={isAr} />
              <VField label={t.city} value={editForm.city} onChangeText={v => setEditForm(f => ({ ...f, city: v }))} isAr={isAr} />
              <VField label={t.country} value={editForm.country} onChangeText={v => setEditForm(f => ({ ...f, country: v }))} isAr={isAr} />
              <VField label={t.whatsapp} value={editForm.whatsapp} onChangeText={v => setEditForm(f => ({ ...f, whatsapp: v }))} keyboardType="phone-pad" isAr={false} />
              <VField label={t.wechat} value={editForm.wechat} onChangeText={v => setEditForm(f => ({ ...f, wechat: v }))} isAr={false} />
              <TouchableOpacity
                style={[s.submitBtn, saving && { opacity: 0.6 }]}
                onPress={saveProfile}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.saveChanges}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Verification Modal ── */}
      <Modal visible={showVerify} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => setShowVerify(false)}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.verifyTitle}</Text>
              </View>

              <Text style={[s.verifyNote, isAr && s.rtl]}>{t.verifyNote}</Text>

              <VField label={t.regNumber} value={verifyForm.regNumber} onChangeText={v => setV('regNumber', v)} isAr={isAr} />
              <VField label={t.yearsExp} value={verifyForm.yearsExperience} onChangeText={v => setV('yearsExperience', v)} keyboardType="numeric" isAr={isAr} />

              <Text style={[s.sectionDivider, isAr && s.rtl]}>{t.payoutSection}</Text>
              <VField label={t.payoutName} value={verifyForm.payoutName} onChangeText={v => setV('payoutName', v)} isAr={isAr} />
              <VField label={t.bankName} value={verifyForm.bankName} onChangeText={v => setV('bankName', v)} isAr={isAr} />
              <VField label={t.swift} value={verifyForm.swiftCode} onChangeText={v => setV('swiftCode', v)} autoCapitalize="characters" isAr={false} />
              <VField label={t.iban} value={verifyForm.iban} onChangeText={v => setV('iban', v)} autoCapitalize="characters" isAr={false} />

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitVerification}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.submitVerify}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, isAr }) {
  return (
    <View style={[s.infoRow, isAr && s.infoRowRtl]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatTile({ label, value }) {
  return (
    <View style={s.statTile}>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function VField({ label, isAr, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, isAr && s.rtl]}>{label}</Text>
      <TextInput
        style={[s.input, isAr && s.rtl]}
        placeholderTextColor={C.textDisabled}
        {...props}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingBottom: 60 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  profileHeader: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.bgRaised, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1, borderColor: C.borderDefault,
  },
  avatarText: { color: C.textSecondary, fontSize: 28, fontFamily: F.enBold },
  companyName: { color: C.textPrimary, fontSize: 20, fontFamily: F.arSemi, marginBottom: 4 },
  supplierId: { color: C.textDisabled, fontSize: 11, fontFamily: F.en, marginBottom: 10 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1 },
  statusText: { fontSize: 13, fontFamily: F.arSemi },

  editProfileBtn: {
    marginTop: 14, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1, borderColor: C.borderStrong,
    backgroundColor: C.bgOverlay,
  },
  editProfileText: { color: C.textPrimary, fontSize: 13, fontFamily: F.arSemi },

  verifyBanner: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: C.borderDefault,
    alignItems: 'center',
  },
  verifyBannerTitle: { color: C.textPrimary, fontSize: 15, fontFamily: F.arSemi, marginBottom: 4 },
  verifyBannerSub: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, textAlign: 'center' },

  blockHeader: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi,
    letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
  },
  statTile: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: C.bgRaised, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  statValue: {
    color: C.textPrimary, fontSize: 22, fontFamily: F.enBold,
    lineHeight: 26, marginBottom: 4,
  },
  statLabel: {
    color: C.textSecondary, fontSize: 11, fontFamily: F.ar,
  },
  quickActions: {
    gap: 8, marginBottom: 20,
  },
  qaBtn: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    alignItems: 'center',
  },
  qaBtnPrimary: {
    backgroundColor: C.btnPrimary, borderColor: C.btnPrimary,
  },
  qaText: { color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi },
  qaTextPrimary: { color: C.btnPrimaryText },

  section: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    marginBottom: 16, overflow: 'hidden',
  },
  sectionTitle: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi,
    padding: 14, paddingBottom: 8, letterSpacing: 0.5,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoRowRtl: { flexDirection: 'row-reverse' },
  infoLabel: { color: C.textSecondary, fontSize: 14, fontFamily: F.ar },
  infoValue: { color: C.textPrimary, fontSize: 14, fontFamily: F.en, maxWidth: '60%' },

  signOutBtn: {
    backgroundColor: C.redSoft, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: C.red + '40', marginTop: 8,
  },
  signOutText: { color: C.red, fontFamily: F.arSemi, fontSize: 16 },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },
  verifyNote: {
    color: C.textSecondary, fontSize: 13, fontFamily: F.ar,
    lineHeight: 20, marginBottom: 20,
    backgroundColor: C.bgRaised, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  sectionDivider: {
    color: C.textTertiary, fontSize: 12, fontFamily: F.arSemi,
    marginVertical: 12,
  },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, fontFamily: F.ar,
  },
  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
