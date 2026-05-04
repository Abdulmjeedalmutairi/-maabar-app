// SupplierOnboardingScreen — post-approval 4-step onboarding overlay.
//
// Mirrors web/src/components/supplier/SupplierOnboardingSequence.jsx exactly:
//   A. Welcome  — congratulates the supplier; shows Maabar Supplier ID pill
//   B. Profile  — company description, business type, year established,
//                 employees, website, export markets, quality certifications
//                 (multi-entry rows with file upload to supplier-certifications)
//   C. Bank     — beneficiary, bank, account, SWIFT (all required), IBAN
//                 (optional), preferred display currency. "Complete later"
//                 link skips this step without saving.
//   D. Ready    — celebratory CTA card; flips onboarding_completed=true and
//                 navigates to either SProducts (Upload First Product) or
//                 SRequests (Browse Buyer Requests).
//
// Mount: rendered as a full-screen absolute-positioned overlay (zIndex 1000)
// over SupplierTabs by RootNavigator when status is verified/approved/active
// AND onboarding_completed !== true.
//
// Hardware back: blocked while overlay is mounted (mirrors web's no-escape UX).
// Pre-fill: hydrates fields from the live profile row on mount via select('*').

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Platform, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// ─── i18n ────────────────────────────────────────────────────────────────────
const T = {
  ar: {
    stepWelcome: 'الترحيب',
    stepProfile: 'الملف',
    stepBank: 'الاستلام',
    stepReady: 'جاهز',

    // Step A
    welcomeTitle: 'تهانينا، تم قبولك!',
    welcomeIntro: 'حسابك الآن موثّق على معبر. لنكمل آخر خطوات الإعداد قبل أن تستقبل طلبات التجار.',
    welcomeBtn: 'ابدأ الإعداد ←',
    supplierIdLabel: 'معرّف مورد مَعبر',

    // Step B
    profileTitle: 'أكمل ملف الشركة',
    profileSub: 'هذه التفاصيل تظهر للمشترين السعوديين على ملفك العام.',
    companyDescription: 'وصف الشركة',
    descriptionHint: 'يمكنك الكتابة بأي لغة',
    businessType: 'نوع النشاط',
    businessTypeHint: 'مصنّع / تاجر جملة',
    yearEstablished: 'سنة التأسيس',
    numEmployees: 'عدد الموظفين',
    companyWebsite: 'موقع الشركة',
    exportMarkets: 'أسواق التصدير',
    exportMarketsHint: 'افصل بين الأسواق بفاصلة (مثال: السعودية، الإمارات، الأردن)',
    qualityCertifications: 'شهادات الجودة',
    certName: 'اسم الشهادة (مثال: ISO 9001)',
    addCert: '+ إضافة شهادة',
    uploadCert: 'رفع ملف',
    certFileTypesHint: 'PDF أو JPG أو PNG · حد أقصى 10 ميغابايت',
    certUploaded: 'تم الرفع',
    certUploading: 'جاري الرفع...',
    certReplace: 'استبدال',
    certRemove: 'حذف',
    certUploadFailed: 'فشل رفع الملف',
    saveContinueBtn: 'حفظ ومتابعة',
    savingError: 'تعذر الحفظ. حاول مرة أخرى.',
    saving: 'جاري الحفظ...',

    // Step C
    bankTitle: 'أضف بيانات الاستلام',
    bankNote: 'بياناتك البنكية مشفرة وتُستخدم فقط لتحويل المدفوعات إليك.',
    beneficiaryName: 'اسم المستفيد',
    bankName: 'اسم البنك',
    accountNumber: 'رقم الحساب',
    swift: 'رمز SWIFT',
    iban: 'IBAN (اختياري)',
    preferredCurrency: 'العملة المفضلة للعرض',
    bankSkipLink: 'أكمل لاحقاً',
    bankRequiredError: 'أكمل اسم المستفيد، اسم البنك، رقم الحساب، ورمز SWIFT، أو اضغط على "أكمل لاحقاً".',

    // Step D
    readyTitle: 'أنت جاهز! ابدأ برفع منتجاتك',
    readyBody: 'منتجاتك ستكون جاهزة للتجار السعوديين فور الإطلاق الرسمي للمنصة.',
    readyPrimary: 'رفع أول منتج',
    readySecondary: 'تصفح طلبات التجار',
    finishing: 'جاري الإنهاء...',
  },
  en: {
    stepWelcome: 'Welcome',
    stepProfile: 'Profile',
    stepBank: 'Bank',
    stepReady: 'Ready',

    welcomeTitle: 'Congratulations, you have been approved!',
    welcomeIntro: 'Your account is now verified on Maabar. Let us finish the last setup steps before buyer requests start coming in.',
    welcomeBtn: 'Start Setup →',
    supplierIdLabel: 'Maabar Supplier ID',

    profileTitle: 'Complete your company profile',
    profileSub: 'These details show up for Saudi buyers on your public profile.',
    companyDescription: 'Company description',
    descriptionHint: 'You can write in any language',
    businessType: 'Business type',
    businessTypeHint: 'Manufacturer / Wholesaler',
    yearEstablished: 'Year established',
    numEmployees: 'Number of employees',
    companyWebsite: 'Company website',
    exportMarkets: 'Export markets',
    exportMarketsHint: 'Comma-separated (e.g. Saudi Arabia, UAE, Jordan)',
    qualityCertifications: 'Quality certifications',
    certName: 'Cert name (e.g. ISO 9001)',
    addCert: '+ Add certification',
    uploadCert: 'Upload file',
    certFileTypesHint: 'PDF, JPG, PNG · 10 MB max',
    certUploaded: 'Uploaded',
    certUploading: 'Uploading...',
    certReplace: 'Replace',
    certRemove: 'Remove',
    certUploadFailed: 'Upload failed',
    saveContinueBtn: 'Save and continue',
    savingError: 'Failed to save. Please try again.',
    saving: 'Saving...',

    bankTitle: 'Add your payout details',
    bankNote: 'Your bank details are encrypted and used only to send payments to you.',
    beneficiaryName: 'Beneficiary name',
    bankName: 'Bank name',
    accountNumber: 'Account number',
    swift: 'SWIFT code',
    iban: 'IBAN (optional)',
    preferredCurrency: 'Preferred display currency',
    bankSkipLink: 'Complete later',
    bankRequiredError: 'Complete Beneficiary, Bank, Account number, and SWIFT — or tap "Complete later".',

    readyTitle: 'You are ready! Start uploading products',
    readyBody: 'Your products will be ready for Saudi buyers when the platform officially launches.',
    readyPrimary: 'Upload First Product',
    readySecondary: 'Browse Buyer Requests',
    finishing: 'Finishing...',
  },
  zh: {
    stepWelcome: '欢迎',
    stepProfile: '资料',
    stepBank: '收款',
    stepReady: '完成',

    welcomeTitle: '恭喜您通过审核！',
    welcomeIntro: '您的账户已在 Maabar 完成认证。让我们完成最后的设置步骤，迎接买家询单。',
    welcomeBtn: '开始设置 →',
    supplierIdLabel: 'Maabar 供应商编号',

    profileTitle: '完善公司资料',
    profileSub: '这些信息将展示在您的公开主页上，供沙特买家查看。',
    companyDescription: '公司介绍',
    descriptionHint: '可使用任意语言填写',
    businessType: '企业类型',
    businessTypeHint: '制造商 / 批发商',
    yearEstablished: '成立年份',
    numEmployees: '员工人数',
    companyWebsite: '公司官网',
    exportMarkets: '出口市场',
    exportMarketsHint: '用逗号分隔（例如：沙特、阿联酋、约旦）',
    qualityCertifications: '质量认证',
    certName: '认证名称（例如：ISO 9001）',
    addCert: '+ 添加认证',
    uploadCert: '上传文件',
    certFileTypesHint: 'PDF / JPG / PNG · 最大 10MB',
    certUploaded: '已上传',
    certUploading: '上传中...',
    certReplace: '更换',
    certRemove: '删除',
    certUploadFailed: '上传失败',
    saveContinueBtn: '保存并继续',
    savingError: '保存失败，请重试。',
    saving: '保存中...',

    bankTitle: '添加收款信息',
    bankNote: '您的银行信息已加密，仅用于向您支付。',
    beneficiaryName: '收款人姓名',
    bankName: '银行名称',
    accountNumber: '账号',
    swift: 'SWIFT 代码',
    iban: 'IBAN（可选）',
    preferredCurrency: '首选展示货币',
    bankSkipLink: '稍后完成',
    bankRequiredError: '请完成收款人、银行名称、账号、SWIFT，或点击"稍后完成"。',

    readyTitle: '您已准备好！开始上传产品',
    readyBody: '平台正式上线后，您的产品将展示给沙特买家。',
    readyPrimary: '上传第一个产品',
    readySecondary: '浏览采购需求',
    finishing: '正在完成...',
  },
};

const tx = (k, lang) => T[lang]?.[k] ?? T.en[k] ?? k;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hydrateCerts(rawCerts = []) {
  if (!Array.isArray(rawCerts)) return [];
  return rawCerts
    .map((c) => {
      const name = typeof c === 'string' ? c : (c && c.name) ? c.name : '';
      const fileUrl = (c && typeof c === 'object' && c.file_url) ? c.file_url : null;
      return {
        _id: Math.random().toString(36).slice(2, 10),
        name,
        file_url: fileUrl,
        uploading: false,
        error: null,
      };
    })
    .filter((c) => c.name || c.file_url);
}

function serializeArray(arr) {
  return Array.isArray(arr) ? arr.filter(Boolean).join(', ') : '';
}

function parseArray(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function SupplierOnboardingScreen({
  user,
  profile,
  setProfile,
  onComplete,
  onNavigateToTab,
}) {
  const lang = getLang();
  const isAr = lang === 'ar';
  const t = (k) => tx(k, lang);

  const [step, setStep] = useState('welcome');
  const [hydrated, setHydrated] = useState(false);

  // Step B
  const [companyDescription, setCompanyDescription] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [yearEstablished, setYearEstablished] = useState('');
  const [numEmployees, setNumEmployees] = useState('');
  const [exportMarketsRaw, setExportMarketsRaw] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [certs, setCerts] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Step C
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [iban, setIban] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState('');

  const [completing, setCompleting] = useState(false);
  const [supplierMaabarId, setSupplierMaabarId] = useState(profile?.maabar_supplier_id || '');

  // ── Hydrate from full profile row on mount ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled || !data) { setHydrated(true); return; }
      setCompanyDescription(data.company_description || data.bio_en || data.bio_ar || data.bio_zh || '');
      setBusinessType(data.business_type || '');
      setYearEstablished(data.year_established != null ? String(data.year_established) : '');
      setNumEmployees(data.num_employees != null ? String(data.num_employees) : '');
      setExportMarketsRaw(serializeArray(data.export_markets));
      setCompanyWebsite(data.company_website || '');
      setCerts(hydrateCerts(data.certifications));
      setBeneficiaryName(data.payout_beneficiary_name || '');
      setBankName(data.bank_name || '');
      setAccountNumber(data.payout_account_number || '');
      setSwiftCode(data.swift_code || '');
      setIban(data.payout_iban || '');
      setPreferredCurrency(data.preferred_display_currency || 'USD');
      setSupplierMaabarId(data.maabar_supplier_id || '');
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  // ── Block hardware back (matches web's no-escape UX) ─────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // ── Cert handlers ────────────────────────────────────────────────────────
  const updateCertRow = (id, patch) => {
    setCerts((prev) => prev.map((c) => (c._id === id ? { ...c, ...patch } : c)));
  };

  const addCertRow = () => {
    setCerts((prev) => [
      ...prev,
      { _id: Math.random().toString(36).slice(2, 10), name: '', file_url: null, uploading: false, error: null },
    ]);
  };

  const removeCertRow = (id) => {
    setCerts((prev) => prev.filter((c) => c._id !== id));
  };

  const removeCertFile = (id) => {
    updateCertRow(id, { file_url: null, error: null });
  };

  const uploadCertFile = async (id) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      updateCertRow(id, { uploading: true, error: null });
      const ext = (asset.name?.split('.').pop() || 'pdf').toLowerCase();
      const path = `${user.id}/cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
      const { error } = await supabase.storage
        .from('supplier-certifications')
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType || 'application/octet-stream',
          upsert: true,
        });
      if (error) {
        updateCertRow(id, { uploading: false, error: t('certUploadFailed') });
        return;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('supplier-certifications')
        .getPublicUrl(path);
      updateCertRow(id, { uploading: false, file_url: publicUrl, error: null });
    } catch (e) {
      console.error('[onboarding] cert upload error:', e?.message || e);
      updateCertRow(id, { uploading: false, error: t('certUploadFailed') });
    }
  };

  // ── Save handlers ────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setProfileError('');
    setSavingProfile(true);
    const yr = yearEstablished ? parseInt(yearEstablished, 10) : null;
    const ne = numEmployees ? parseInt(numEmployees, 10) : null;
    const certsArray = certs
      .map((c) => ({ name: String(c.name || '').trim(), file_url: c.file_url || null }))
      .filter((c) => c.name || c.file_url);
    const description = String(companyDescription || '').trim();
    const payload = {
      company_description: description || null,
      bio_en: description || null,
      business_type: String(businessType || '').trim() || null,
      year_established: Number.isFinite(yr) ? yr : null,
      num_employees: Number.isFinite(ne) ? ne : null,
      export_markets: parseArray(exportMarketsRaw),
      certifications: certsArray,
      company_website: String(companyWebsite || '').trim() || null,
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      console.error('[onboarding] saveProfile error:', error);
      setProfileError(t('savingError'));
      return;
    }
    if (setProfile) setProfile((prev) => ({ ...(prev || {}), ...payload }));
    setStep('bank');
  };

  const saveBank = async () => {
    setBankError('');
    const beneficiary = String(beneficiaryName || '').trim();
    const bank = String(bankName || '').trim();
    const account = String(accountNumber || '').trim();
    const swift = String(swiftCode || '').trim();
    if (!beneficiary || !bank || !account || !swift) {
      setBankError(t('bankRequiredError'));
      return;
    }
    setSavingBank(true);
    const payload = {
      pay_method: 'swift',
      payout_beneficiary_name: beneficiary,
      bank_name: bank,
      payout_account_number: account,
      swift_code: swift,
      payout_iban: String(iban || '').trim() || null,
      preferred_display_currency: String(preferredCurrency || 'USD').trim() || 'USD',
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setSavingBank(false);
    if (error) {
      console.error('[onboarding] saveBank error:', error);
      setBankError(t('savingError'));
      return;
    }
    if (setProfile) setProfile((prev) => ({ ...(prev || {}), ...payload }));
    setStep('ready');
  };

  const completeOnboarding = async (targetTab) => {
    setCompleting(true);
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);
    if (error) {
      console.error('[onboarding] complete error:', error);
      // Best-effort: still close overlay so admin can re-trigger if needed
    }
    if (setProfile) setProfile((prev) => ({ ...(prev || {}), onboarding_completed: true }));
    if (onComplete) onComplete();
    if (targetTab && onNavigateToTab) onNavigateToTab(targetTab);
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StepIndicator step={step} lang={lang} isAr={isAr} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── A. WELCOME ─── */}
        {step === 'welcome' && (
          <View style={{ alignItems: 'center', paddingTop: 24 }}>
            <Text style={[s.welcomeTitle, { fontFamily: isAr ? F.arBold : F.enBold }, isAr && s.rtl]}>
              {t('welcomeTitle')}
            </Text>
            <Text style={[s.welcomeIntro, { fontFamily: isAr ? F.ar : F.en }, isAr && s.rtl]}>
              {t('welcomeIntro')}
            </Text>

            {!!supplierMaabarId && (
              <View style={s.idPill}>
                <Text style={[s.idCheck, { fontFamily: F.enBold }]}>✓</Text>
                <Text style={[s.idText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                  {t('supplierIdLabel')} · {supplierMaabarId}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── B. PROFILE ─── */}
        {step === 'profile' && (
          <View>
            <Text style={[s.stepTitle, { fontFamily: isAr ? F.arBold : F.enBold }, isAr && s.rtl]}>
              {t('profileTitle')}
            </Text>
            <Text style={[s.stepSub, { fontFamily: isAr ? F.ar : F.en }, isAr && s.rtl]}>
              {t('profileSub')}
            </Text>

            <Field
              label={t('companyDescription')} hint={t('descriptionHint')}
              value={companyDescription} onChangeText={setCompanyDescription}
              multiline isAr={isAr}
            />
            <Field
              label={t('businessType')} placeholder={t('businessTypeHint')}
              value={businessType} onChangeText={setBusinessType} isAr={isAr}
            />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('yearEstablished')} value={yearEstablished}
                  onChangeText={setYearEstablished} keyboardType="numeric"
                  dirOverride="ltr" maxLength={4}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('numEmployees')} value={numEmployees}
                  onChangeText={setNumEmployees} keyboardType="numeric"
                  dirOverride="ltr"
                />
              </View>
            </View>
            <Field
              label={t('companyWebsite')} value={companyWebsite}
              onChangeText={setCompanyWebsite} keyboardType="url"
              autoCapitalize="none" dirOverride="ltr" placeholder="https://..."
            />
            <Field
              label={t('exportMarkets')} hint={t('exportMarketsHint')}
              value={exportMarketsRaw} onChangeText={setExportMarketsRaw}
              isAr={isAr}
            />

            {/* ─── Quality Certifications ─── */}
            <Text style={[s.fieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en, marginTop: 18 }]}>
              {t('qualityCertifications')}
            </Text>
            <View style={{ gap: 10 }}>
              {certs.map((cert) => (
                <CertRow
                  key={cert._id}
                  cert={cert}
                  isAr={isAr}
                  lang={lang}
                  onChangeName={(v) => updateCertRow(cert._id, { name: v })}
                  onUpload={() => uploadCertFile(cert._id)}
                  onRemoveFile={() => removeCertFile(cert._id)}
                  onRemoveRow={() => removeCertRow(cert._id)}
                />
              ))}
            </View>
            <TouchableOpacity onPress={addCertRow} style={s.addCertBtn} activeOpacity={0.85}>
              <Text style={[s.addCertBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('addCert')}
              </Text>
            </TouchableOpacity>
            <Text style={[s.fieldHint, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en, marginTop: 6 }]}>
              {t('certFileTypesHint')}
            </Text>

            {!!profileError && (
              <Text style={[s.errorText, { fontFamily: isAr ? F.ar : F.en }]}>{profileError}</Text>
            )}
          </View>
        )}

        {/* ─── C. BANK ─── */}
        {step === 'bank' && (
          <View>
            <Text style={[s.stepTitle, { fontFamily: isAr ? F.arBold : F.enBold }, isAr && s.rtl]}>
              {t('bankTitle')}
            </Text>
            <View style={s.bankNote}>
              <Text style={[s.bankNoteText, { fontFamily: isAr ? F.ar : F.en }, isAr && s.rtl]}>
                {t('bankNote')}
              </Text>
            </View>

            <Field
              label={t('beneficiaryName')} required
              value={beneficiaryName} onChangeText={setBeneficiaryName} isAr={isAr}
            />
            <Field
              label={t('bankName')} required
              value={bankName} onChangeText={setBankName} isAr={isAr}
            />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('accountNumber')} required
                  value={accountNumber} onChangeText={setAccountNumber}
                  dirOverride="ltr"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('swift')} required
                  value={swiftCode} onChangeText={setSwiftCode}
                  autoCapitalize="characters" dirOverride="ltr"
                />
              </View>
            </View>
            <Field
              label={t('iban')} value={iban} onChangeText={setIban}
              autoCapitalize="characters" dirOverride="ltr"
            />

            <Text style={[s.fieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en, marginTop: 6 }]}>
              {t('preferredCurrency')}
            </Text>
            <View style={[s.currencyPills, isAr && s.rowRtl]}>
              {['USD', 'SAR', 'CNY', 'EUR'].map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[s.currencyPill, preferredCurrency === code && s.currencyPillActive]}
                  onPress={() => setPreferredCurrency(code)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      s.currencyPillText,
                      preferredCurrency === code && s.currencyPillTextActive,
                      { fontFamily: F.enSemi },
                    ]}
                  >
                    {code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!bankError && (
              <Text style={[s.errorText, { fontFamily: isAr ? F.ar : F.en }]}>{bankError}</Text>
            )}
          </View>
        )}

        {/* ─── D. READY ─── */}
        {step === 'ready' && (
          <View style={{ alignItems: 'center', paddingTop: 16 }}>
            <View style={s.readyCircle}>
              <Text style={[s.readyCheck, { fontFamily: F.enBold }]}>✓</Text>
            </View>
            <Text style={[s.welcomeTitle, { fontFamily: isAr ? F.arBold : F.enBold }, isAr && s.rtl]}>
              {t('readyTitle')}
            </Text>
            <Text style={[s.welcomeIntro, { fontFamily: isAr ? F.ar : F.en }, isAr && s.rtl]}>
              {t('readyBody')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ─── Sticky bottom bar ─── */}
      <View style={s.bottomBar}>
        {step === 'welcome' && (
          <TouchableOpacity
            style={[s.primaryBtn, { width: '100%' }]}
            onPress={() => setStep('profile')}
            activeOpacity={0.85}
          >
            <Text style={[s.primaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
              {t('welcomeBtn')}
            </Text>
          </TouchableOpacity>
        )}

        {step === 'profile' && (
          <TouchableOpacity
            style={[s.primaryBtn, { width: '100%' }, savingProfile && { opacity: 0.6 }]}
            onPress={saveProfile}
            disabled={savingProfile}
            activeOpacity={0.85}
          >
            {savingProfile
              ? <ActivityIndicator color={C.btnPrimaryText} />
              : <Text style={[s.primaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                  {t('saveContinueBtn')}
                </Text>}
          </TouchableOpacity>
        )}

        {step === 'bank' && (
          <View style={{ width: '100%', gap: 12 }}>
            <TouchableOpacity
              style={[s.primaryBtn, savingBank && { opacity: 0.6 }]}
              onPress={saveBank}
              disabled={savingBank}
              activeOpacity={0.85}
            >
              {savingBank
                ? <ActivityIndicator color={C.btnPrimaryText} />
                : <Text style={[s.primaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                    {t('saveContinueBtn')}
                  </Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStep('ready')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[s.skipLink, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('bankSkipLink')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'ready' && (
          <View style={{ width: '100%', gap: 10 }}>
            <TouchableOpacity
              style={[s.primaryBtn, completing && { opacity: 0.6 }]}
              onPress={() => completeOnboarding('SProducts')}
              disabled={completing}
              activeOpacity={0.85}
            >
              {completing
                ? <ActivityIndicator color={C.btnPrimaryText} />
                : <Text style={[s.primaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                    {t('readyPrimary')}
                  </Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, completing && { opacity: 0.6 }]}
              onPress={() => completeOnboarding('SRequests')}
              disabled={completing}
              activeOpacity={0.85}
            >
              <Text style={[s.secondaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('readySecondary')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function StepIndicator({ step, lang, isAr }) {
  const order = ['welcome', 'profile', 'bank', 'ready'];
  const idx = order.indexOf(step);
  const labels = [
    tx('stepWelcome', lang),
    tx('stepProfile', lang),
    tx('stepBank', lang),
    tx('stepReady', lang),
  ];
  return (
    <View style={[si.row, isAr && si.rowRtl]}>
      {order.map((key, i) => {
        const done = i < idx;
        const cur = i === idx;
        return (
          <View key={key} style={si.cell}>
            <View style={[si.pill, done && si.pillDone, cur && si.pillCur]}>
              <Text
                style={[si.pillText, (done || cur) && si.pillTextActive, { fontFamily: isAr ? F.arSemi : F.enSemi }]}
                numberOfLines={1}
              >
                {labels[i]}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderSubtle, backgroundColor: C.bgBase },
  rowRtl: { flexDirection: 'row-reverse' },
  cell: { flex: 1 },
  pill: { paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: C.borderSubtle, backgroundColor: 'transparent' },
  pillDone: { backgroundColor: C.greenSoft, borderColor: 'rgba(0,100,0,0.22)' },
  pillCur: { backgroundColor: C.bgRaised, borderColor: C.borderStrong },
  pillText: { fontSize: 11, color: C.textDisabled },
  pillTextActive: { color: C.textPrimary },
});

function Field({ label, hint, required, isAr, dirOverride, multiline, ...inputProps }) {
  const dir = dirOverride || (isAr ? 'rtl' : 'ltr');
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.fieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
        {label}{required ? <Text style={s.required}>{' *'}</Text> : null}
      </Text>
      <TextInput
        style={[
          s.fieldInput,
          multiline && s.fieldInputMulti,
          { textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir, fontFamily: isAr ? F.ar : F.en },
        ]}
        placeholderTextColor={C.textDisabled}
        multiline={multiline}
        {...inputProps}
      />
      {!!hint && (
        <Text style={[s.fieldHint, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>{hint}</Text>
      )}
    </View>
  );
}

function CertRow({ cert, isAr, lang, onChangeName, onUpload, onRemoveFile, onRemoveRow }) {
  const t = (k) => tx(k, lang);
  return (
    <View style={[s.certRow, isAr && s.rowRtl]}>
      <TextInput
        style={[s.certNameInput, { fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' }]}
        placeholder={t('certName')}
        placeholderTextColor={C.textDisabled}
        value={cert.name}
        onChangeText={onChangeName}
      />

      {cert.uploading ? (
        <Text style={[s.certStatus, { fontFamily: isAr ? F.ar : F.en }]}>{t('certUploading')}</Text>
      ) : cert.file_url ? (
        <View style={[s.certUploadedPill, isAr && s.rowRtl]}>
          <Text style={[s.certUploadedCheck, { fontFamily: F.enBold }]}>✓</Text>
          <Text style={[s.certUploadedText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
            {t('certUploaded')}
          </Text>
          <TouchableOpacity onPress={onRemoveFile} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[s.certUploadedRemove, { fontFamily: F.enBold }]}>×</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onUpload} style={s.certUploadBtn} activeOpacity={0.85}>
          <Text style={[s.certUploadBtnText, { fontFamily: isAr ? F.ar : F.en }]}>
            {t('uploadCert')}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onRemoveRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.certRowRemove}>
        <Text style={[s.certRowRemoveText, { fontFamily: F.enBold }]}>×</Text>
      </TouchableOpacity>

      {!!cert.error && (
        <Text style={[s.certErrorText, { fontFamily: isAr ? F.ar : F.en }]}>{cert.error}</Text>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  content: { padding: 24, paddingBottom: 80 },

  welcomeTitle: {
    color: C.textPrimary, fontSize: 28, lineHeight: 34,
    textAlign: 'center', marginBottom: 14, paddingHorizontal: 4,
  },
  welcomeIntro: {
    color: C.textSecondary, fontSize: 14, lineHeight: 22,
    textAlign: 'center', marginBottom: 24, maxWidth: 360,
  },

  idPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.greenSoft,
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.22)',
    marginTop: 8,
  },
  idCheck: { color: C.green, fontSize: 13 },
  idText: { color: C.green, fontSize: 13, letterSpacing: 0.4 },

  stepTitle: { color: C.textPrimary, fontSize: 24, lineHeight: 30, marginBottom: 6 },
  stepSub: { color: C.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 22 },

  fieldLabel: { color: C.textSecondary, fontSize: 12, marginBottom: 6 },
  required: { color: C.red, fontSize: 12 },
  fieldInput: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15,
  },
  fieldInputMulti: { minHeight: 90, textAlignVertical: 'top' },
  fieldHint: { color: C.textDisabled, fontSize: 11, marginTop: 4 },

  row2: { flexDirection: 'row', gap: 10 },

  // Cert row
  certRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  certNameInput: {
    flex: 1, minWidth: 140,
    color: C.textPrimary, fontSize: 14,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  certStatus: { color: C.textSecondary, fontSize: 11, paddingHorizontal: 8 },
  certUploadBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgBase,
  },
  certUploadBtnText: { color: C.textSecondary, fontSize: 12 },
  certUploadedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: C.greenSoft,
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.22)',
  },
  certUploadedCheck: { color: C.green, fontSize: 11 },
  certUploadedText: { color: C.green, fontSize: 11 },
  certUploadedRemove: { color: C.green, fontSize: 14, lineHeight: 14 },
  certRowRemove: { paddingHorizontal: 4 },
  certRowRemoveText: { color: C.textDisabled, fontSize: 18, lineHeight: 18 },
  certErrorText: { flexBasis: '100%', color: C.red, fontSize: 11, marginTop: 4 },

  addCertBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.borderSubtle, borderStyle: 'dashed',
    backgroundColor: 'transparent', marginTop: 10,
  },
  addCertBtnText: { color: C.textSecondary, fontSize: 12 },

  // Bank
  bankNote: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 14, marginBottom: 22,
  },
  bankNoteText: { color: C.textTertiary, fontSize: 12, lineHeight: 19 },

  currencyPills: {
    flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap',
  },
  currencyPill: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised, minWidth: 64, alignItems: 'center',
  },
  currencyPillActive: { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  currencyPillText: { color: C.textSecondary, fontSize: 13, letterSpacing: 0.4 },
  currencyPillTextActive: { color: C.btnPrimaryText },

  // Ready
  readyCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(0,100,0,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  readyCheck: { color: C.green, fontSize: 26 },

  errorText: {
    color: C.red, fontSize: 13,
    textAlign: 'center', marginTop: 10,
  },

  skipLink: {
    color: C.textSecondary, fontSize: 13,
    textAlign: 'center', textDecorationLine: 'underline',
  },

  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  primaryBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: C.btnPrimaryText, fontSize: 15 },
  secondaryBtn: {
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: C.textPrimary, fontSize: 14 },
});
