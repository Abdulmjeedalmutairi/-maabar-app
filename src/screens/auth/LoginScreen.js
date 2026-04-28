import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';

// ── Copy (mirrors web L object keys) ─────────────────────────────────────────
const T = {
  ar: {
    tabSignIn: 'تسجيل الدخول',
    tabSignUp: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    pass: 'كلمة المرور',
    signInBtn: 'تسجيل الدخول',
    googleBtn: 'دخول بـ Google',
    orDivider: 'أو',
    toSignup: 'ما عندك حساب؟',
    toSignupLink: 'سجل الآن',
    toSignin: 'عندك حساب؟',
    toSigninLink: 'سجل دخولك',
    wrongCredentials: 'إيميل أو كلمة مرور غير صحيحة.',
    emailNotConfirmed: 'يرجى تأكيد بريدك الإلكتروني أولاً.',
    googleError: 'تعذّر تسجيل الدخول بـ Google.',
    fillRequired: 'يرجى تعبئة الحقول الإجبارية.',
    iAm: 'أنا...',
    buyerCard: 'مشتري',
    buyerCardSub: 'أستورد من موردين صينيين',
    supplierCard: 'مورد',
    supplierCardSub: 'أبيع منتجاتي لمشترين سعوديين',
    back: '← رجوع',
    firstName: 'الاسم الأول',
    lastName: 'الاسم الأخير',
    phone: 'رقم الجوال',
    city: 'المدينة',
    supCompany: 'اسم الشركة',
    country: 'الدولة',
    supCity: 'المدينة',
    whatsappOpt: 'واتساب (اختياري)',
    wechatOpt: 'WeChat (اختياري)',
    tradeLink: 'رابط الصفحة التجارية',
    specialityOpt: 'التخصص (اختياري)',
    supplierHint: 'السجل التجاري والوثائق تُطلب لاحقاً في مرحلة التحقق.',
    termsRow: 'أوافق على الشروط والأحكام',
    mustAgreeTerms: 'يجب الموافقة على الشروط والأحكام.',
    signUpBtn: 'إنشاء الحساب',
    submitBtn: 'إرسال الطلب',
    buyerConfirm: 'تم إرسال رسالة تأكيد إلى بريدك. فعّل حسابك ثم سجّل دخولك.',
    supplierConfirm: 'تم استلام طلب المورد. أرسلنا رسالة تأكيد — بعد التفعيل سجّل دخولك لإكمال التحقق.',
    backToSignin: 'العودة لتسجيل الدخول',
    required: 'مطلوب',
  },
  en: {
    tabSignIn: 'Sign In',
    tabSignUp: 'Register',
    email: 'Email',
    pass: 'Password',
    signInBtn: 'Sign In',
    googleBtn: 'Continue with Google',
    orDivider: 'or',
    toSignup: "Don't have an account?",
    toSignupLink: 'Sign up',
    toSignin: 'Already have an account?',
    toSigninLink: 'Sign in',
    wrongCredentials: 'Invalid email or password.',
    emailNotConfirmed: 'Please confirm your email first.',
    googleError: 'Google sign-in failed.',
    fillRequired: 'Please fill all required fields.',
    iAm: 'I am a...',
    buyerCard: 'Buyer',
    buyerCardSub: 'Import from Chinese suppliers',
    supplierCard: 'Supplier',
    supplierCardSub: 'Sell products to Saudi buyers',
    back: '← Back',
    firstName: 'First Name',
    lastName: 'Last Name',
    phone: 'Phone',
    city: 'City',
    supCompany: 'Company Name',
    country: 'Country',
    supCity: 'City',
    whatsappOpt: 'WhatsApp (optional)',
    wechatOpt: 'WeChat (optional)',
    tradeLink: 'Trade Page Link',
    specialityOpt: 'Speciality (optional)',
    supplierHint: 'Business license and documents are requested at a later verification stage.',
    termsRow: 'I agree to the Terms & Conditions',
    mustAgreeTerms: 'You must agree to the Terms & Conditions.',
    signUpBtn: 'Create Account',
    submitBtn: 'Submit Application',
    buyerConfirm: 'A confirmation email was sent. Activate your account then sign in.',
    supplierConfirm: 'Supplier application received. We sent a confirmation email — after activation sign in to complete verification.',
    backToSignin: 'Back to Sign In',
    required: 'required',
  },
  zh: {
    tabSignIn: '登录',
    tabSignUp: '注册',
    email: '电子邮件',
    pass: '密码',
    signInBtn: '登录',
    googleBtn: '使用 Google 登录',
    orDivider: '或',
    toSignup: '没有账户？',
    toSignupLink: '立即注册',
    toSignin: '已有账户？',
    toSigninLink: '登录',
    wrongCredentials: '邮箱或密码错误。',
    emailNotConfirmed: '请先确认邮箱。',
    googleError: 'Google 登录失败。',
    fillRequired: '请填写必填项。',
    iAm: '我是...',
    buyerCard: '买家',
    buyerCardSub: '从中国供应商进口',
    supplierCard: '供应商',
    supplierCardSub: '向沙特买家销售',
    back: '← 返回',
    firstName: '名',
    lastName: '姓',
    phone: '电话',
    city: '城市',
    supCompany: '公司名称',
    country: '国家',
    supCity: '城市',
    whatsappOpt: 'WhatsApp（可选）',
    wechatOpt: 'WeChat（可选）',
    tradeLink: '贸易页面链接',
    specialityOpt: '专业领域（可选）',
    supplierHint: '营业执照和文件将在后续认证阶段提交。',
    termsRow: '我同意条款与条件',
    mustAgreeTerms: '您必须同意条款与条件。',
    signUpBtn: '创建账户',
    submitBtn: '提交申请',
    buyerConfirm: '确认邮件已发送，请激活账户后登录。',
    supplierConfirm: '供应商申请已收到，确认邮件已发送，激活后登录继续认证。',
    backToSignin: '返回登录',
    required: '必填',
  },
};

// Same city lists as web L.cities / SUPPLIER_SIGNUP_CONTENT.citySuggestions
const SAUDI_CITIES = {
  ar: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'تبوك', 'أبها', 'القصيم', 'حائل', 'جازان', 'نجران'],
  en: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha', 'Qassim', 'Hail', 'Jazan', 'Najran'],
  zh: ['利雅得', '吉达', '麦加', '麦地那', '达曼', '霍拜尔', '塔布克', '艾卜哈', '盖西姆', '哈伊勒'],
};

const CHINESE_CITIES = {
  ar: ['Guangzhou', 'Shenzhen', 'Yiwu', 'Ningbo', 'Foshan', 'Dongguan', 'Xiamen', 'Hangzhou', 'Suzhou', 'Qingdao'],
  en: ['Guangzhou', 'Shenzhen', 'Yiwu', 'Ningbo', 'Foshan', 'Dongguan', 'Xiamen', 'Hangzhou', 'Suzhou', 'Qingdao'],
  zh: ['广州', '深圳', '义乌', '宁波', '佛山', '东莞', '厦门', '杭州', '苏州', '青岛'],
};

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const lang = getLang();
  const t    = T[lang] || T.ar;
  const isAr = lang === 'ar';

  // ── Tab
  const [activeTab, setActiveTab] = useState('signin');

  // ── Sign-in state
  const [siEmail,   setSiEmail]   = useState('');
  const [siPass,    setSiPass]    = useState('');
  const [siError,   setSiError]   = useState('');
  const [siLoading, setSiLoading] = useState(false);

  // ── Sign-up state
  const [signupStep, setSignupStep] = useState('role'); // 'role' | 'form'
  const [signupRole, setSignupRole] = useState(null);   // 'buyer' | 'supplier'
  const [form, setForm] = useState({
    email: '', password: '',
    // buyer
    firstName: '', lastName: '', phone: '', city: '',
    // supplier
    supCompany: '', country: 'China', supCity: '',
    whatsapp: '', wechat: '', tradeLink: '', speciality: '',
  });
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [suError,   setSuError]   = useState('');
  const [suLoading, setSuLoading] = useState(false);
  const [success,   setSuccess]   = useState(false);

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function switchTab(tab) {
    setActiveTab(tab);
    setSiError('');
    setSuError('');
  }

  function selectRole(role) {
    setSignupRole(role);
    setSignupStep('form');
    setSuError('');
  }

  function backToRoles() {
    setSignupStep('role');
    setSignupRole(null);
    setSuError('');
    setAgreedTerms(false);
  }

  // ── Sign In ───────────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!siEmail.trim() || !siPass) { setSiError(t.fillRequired); return; }
    setSiLoading(true); setSiError('');

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: siEmail.trim().toLowerCase(),
      password: siPass,
    });

    if (err) {
      const msg = err.message.toLowerCase();
      setSiError(msg.includes('confirm') ? t.emailNotConfirmed : t.wrongCredentials);
      setSiLoading(false); return;
    }

    // Exact same columns as web doSignIn (Login.jsx line 439-443)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id,role,status,full_name,company_name,phone,city,country,speciality,wechat,whatsapp,trade_link,trade_links,reg_number,years_experience,license_photo,factory_photo')
      .eq('id', data.user.id)
      .single();

    console.log('[LoginScreen] signed in user:', data.user.id);
    console.log('[LoginScreen] profile:', profile);
    console.log('[LoginScreen] role:', profile?.role, '| status:', profile?.status);
    // RootNavigator.onAuthStateChange handles routing → BuyerTabs or SupplierTabs

    setSiLoading(false);
  }

  // ── Google ────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setSiLoading(true); setSiError('');
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { skipBrowserRedirect: true },
    });
    setSiLoading(false);
    if (err || !data?.url) { setSiError(t.googleError); return; }
    Linking.openURL(data.url);
  }

  // ── Sign Up ───────────────────────────────────────────────────────────────
  async function handleSignUp() {
    setSuError('');

    // Shared required fields
    if (!form.email.trim() || !form.password) { setSuError(t.fillRequired); return; }

    if (signupRole === 'buyer') {
      if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.city.trim()) {
        setSuError(t.fillRequired); return;
      }
    } else {
      if (!form.supCompany.trim() || !form.country.trim() || !form.supCity.trim() || !form.tradeLink.trim()) {
        setSuError(t.fillRequired); return;
      }
    }

    if (!agreedTerms) { setSuError(t.mustAgreeTerms); return; }

    setSuLoading(true);

    if (signupRole === 'buyer') {
      // ── Buyer signup — exact same query as SignupBuyerScreen.js ──────────
      const { data, error: err } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
            phone: form.phone.trim(),
            city: form.city.trim(),
            role: 'buyer',
            lang: getLang(),
          },
        },
      });

      console.log('[LoginScreen] buyer signUp user:', data?.user?.id);
      console.log('[LoginScreen] buyer signUp error:', err?.message);

      if (err) { setSuError(err.message); setSuLoading(false); return; }

      if (data?.user) {
        // Exact upsert from SignupBuyerScreen.js
        const { error: uErr } = await supabase.from('profiles').upsert({
          id:        data.user.id,
          email:     form.email.trim(),
          full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          phone:     form.phone.trim(),
          city:      form.city.trim(),
          role:      'buyer',
          lang:      getLang(),
        });
        console.log('[LoginScreen] buyer profile upsert:', uErr ? uErr.message : 'ok');
      }

    } else {
      // ── Supplier signup — exact same query as SignupSupplierScreen.js ────
      const { data, error: err } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { company_name: form.supCompany.trim(), role: 'supplier', lang: getLang() },
        },
      });

      console.log('[LoginScreen] supplier signUp user:', data?.user?.id);
      console.log('[LoginScreen] supplier signUp error:', err?.message);

      if (err) { setSuError(err.message); setSuLoading(false); return; }

      if (data?.user) {
        // Exact upsert from SignupSupplierScreen.js
        const { error: uErr } = await supabase.from('profiles').upsert({
          id:           data.user.id,
          email:        form.email.trim(),
          company_name: form.supCompany.trim(),
          country:      form.country.trim(),
          city:         form.supCity.trim(),
          whatsapp:     form.whatsapp.trim(),
          wechat:       form.wechat.trim(),
          trade_link:   form.tradeLink.trim(),
          speciality:   form.speciality.trim(),
          role:         'supplier',
          status:       'registered',
          lang:         getLang(),
        });
        console.log('[LoginScreen] supplier profile upsert:', uErr ? uErr.message : 'ok');
      }
    }

    setSuLoading(false);
    setSuccess(true);
  }

  // ── City lists
  const saudiCities   = SAUDI_CITIES[lang]   || SAUDI_CITIES.en;
  const chineseCities = CHINESE_CITIES[lang] || CHINESE_CITIES.en;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Logo */}
          <View style={s.logoRow}>
            <MaabarLogo size="lg" />
          </View>

          {/* ── Tab strip ─────────────────────────────────────────────────── */}
          <View style={[s.tabs, isAr && s.rowRtl]}>
            {(['signin', 'signup']).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, activeTab === tab && s.tabActive]}
                onPress={() => switchTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabText, activeTab === tab && s.tabTextActive,
                  { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                  {tab === 'signin' ? t.tabSignIn : t.tabSignUp}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ══════════════ SIGN IN ══════════════ */}
          {activeTab === 'signin' && (
            <View>
              <View style={s.card}>
                <Field label={t.email} value={siEmail} onChangeText={setSiEmail}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  isRtl={isAr} />
                <Field label={t.pass} value={siPass} onChangeText={setSiPass}
                  secureTextEntry isRtl={isAr} />

                {!!siError && <Text style={[s.error, isAr && s.rtl]}>{siError}</Text>}

                <TouchableOpacity
                  style={[s.btnPrimary, siLoading && s.btnDisabled]}
                  onPress={handleSignIn} disabled={siLoading} activeOpacity={0.85}
                >
                  {siLoading
                    ? <ActivityIndicator color={C.bgBase} />
                    : <Text style={[s.btnPrimaryText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                        {t.signInBtn}
                      </Text>}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={[s.dividerLabel, { fontFamily: isAr ? F.ar : F.en }]}>{t.orDivider}</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Google */}
              <TouchableOpacity
                style={[s.btnGoogle, siLoading && s.btnDisabled]}
                onPress={handleGoogle} disabled={siLoading} activeOpacity={0.85}
              >
                <Text style={[s.btnGoogleText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                  {t.googleBtn}
                </Text>
              </TouchableOpacity>

              {/* Switch row */}
              <View style={s.switchRow}>
                <Text style={[s.switchLabel, { fontFamily: isAr ? F.ar : F.en }]}>{t.toSignup} </Text>
                <TouchableOpacity onPress={() => switchTab('signup')} activeOpacity={0.75}>
                  <Text style={[s.switchLink, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                    {t.toSignupLink}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════ SIGN UP ══════════════ */}
          {activeTab === 'signup' && (
            <View>

              {/* ── Success ── */}
              {success ? (
                <View style={s.successBox}>
                  <Text style={[s.successText, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                    {signupRole === 'buyer' ? t.buyerConfirm : t.supplierConfirm}
                  </Text>
                  <TouchableOpacity
                    style={s.btnPrimary}
                    onPress={() => {
                      setSuccess(false);
                      backToRoles();
                      switchTab('signin');
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.btnPrimaryText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                      {t.backToSignin}
                    </Text>
                  </TouchableOpacity>
                </View>

              ) : signupStep === 'role' ? (
                /* ── Role selection ── */
                <View>
                  <Text style={[s.rolePrompt, { fontFamily: isAr ? F.ar : F.en },
                    isAr && s.rtl]}>{t.iAm}</Text>

                  <View style={[s.roleRow, isAr && s.rowRtl]}>
                    <TouchableOpacity
                      style={s.roleCard}
                      onPress={() => selectRole('buyer')}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.roleCardTitle, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                        {t.buyerCard}
                      </Text>
                      <Text style={[s.roleCardSub, { fontFamily: isAr ? F.ar : F.en }]}>
                        {t.buyerCardSub}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.roleCard}
                      onPress={() => selectRole('supplier')}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.roleCardTitle, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                        {t.supplierCard}
                      </Text>
                      <Text style={[s.roleCardSub, { fontFamily: isAr ? F.ar : F.en }]}>
                        {t.supplierCardSub}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.switchRow}>
                    <Text style={[s.switchLabel, { fontFamily: isAr ? F.ar : F.en }]}>{t.toSignin} </Text>
                    <TouchableOpacity onPress={() => switchTab('signin')} activeOpacity={0.75}>
                      <Text style={[s.switchLink, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                        {t.toSigninLink}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

              ) : (
                /* ── Form ── */
                <View>
                  <TouchableOpacity onPress={backToRoles} style={s.backBtn} activeOpacity={0.75}>
                    <Text style={[s.backText, { fontFamily: isAr ? F.ar : F.en }]}>{t.back}</Text>
                  </TouchableOpacity>

                  {signupRole === 'supplier' && (
                    <View style={s.hintBox}>
                      <Text style={[s.hintText, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                        {t.supplierHint}
                      </Text>
                    </View>
                  )}

                  <View style={s.card}>

                    {/* ── Buyer fields ── */}
                    {signupRole === 'buyer' && (
                      <>
                        <View style={[s.row, isAr && s.rowRtl]}>
                          <Field label={`${t.firstName} *`} value={form.firstName}
                            onChangeText={v => setField('firstName', v)}
                            style={{ flex: 1 }} isRtl={isAr} />
                          <Field label={`${t.lastName} *`} value={form.lastName}
                            onChangeText={v => setField('lastName', v)}
                            style={{ flex: 1 }} isRtl={isAr} />
                        </View>
                        <Field label={`${t.email} *`} value={form.email}
                          onChangeText={v => setField('email', v)}
                          keyboardType="email-address" autoCapitalize="none"
                          autoCorrect={false} isRtl={isAr} />
                        <Field label={`${t.phone} *`} value={form.phone}
                          onChangeText={v => setField('phone', v)}
                          keyboardType="phone-pad" isRtl={isAr} />
                        <Field label={`${t.pass} *`} value={form.password}
                          onChangeText={v => setField('password', v)}
                          secureTextEntry isRtl={isAr} />
                        {/* City + Saudi city chips */}
                        <View>
                          <Field label={`${t.city} *`} value={form.city}
                            onChangeText={v => setField('city', v)} isRtl={isAr} />
                          <CityChips cities={saudiCities} onSelect={v => setField('city', v)} />
                        </View>
                      </>
                    )}

                    {/* ── Supplier fields ── */}
                    {signupRole === 'supplier' && (
                      <>
                        <Field label={`${t.supCompany} *`} value={form.supCompany}
                          onChangeText={v => setField('supCompany', v)} isRtl={isAr} />
                        <Field label={`${t.email} *`} value={form.email}
                          onChangeText={v => setField('email', v)}
                          keyboardType="email-address" autoCapitalize="none"
                          autoCorrect={false} isRtl={isAr} />
                        <Field label={`${t.pass} *`} value={form.password}
                          onChangeText={v => setField('password', v)}
                          secureTextEntry isRtl={isAr} />
                        <Field label={t.country} value={form.country}
                          onChangeText={v => setField('country', v)} isRtl={isAr} />
                        {/* City + Chinese city chips */}
                        <View>
                          <Field label={`${t.supCity} *`} value={form.supCity}
                            onChangeText={v => setField('supCity', v)} isRtl={isAr} />
                          <CityChips cities={chineseCities} onSelect={v => setField('supCity', v)} />
                        </View>
                        <Field label={`${t.tradeLink} *`} value={form.tradeLink}
                          onChangeText={v => setField('tradeLink', v)}
                          keyboardType="url" autoCapitalize="none" isRtl={isAr} />
                        <Field label={t.whatsappOpt} value={form.whatsapp}
                          onChangeText={v => setField('whatsapp', v)}
                          keyboardType="phone-pad" isRtl={isAr} />
                        <Field label={t.wechatOpt} value={form.wechat}
                          onChangeText={v => setField('wechat', v)} isRtl={isAr} />
                        <Field label={t.specialityOpt} value={form.speciality}
                          onChangeText={v => setField('speciality', v)} isRtl={isAr} />
                      </>
                    )}

                    {/* Terms */}
                    <TouchableOpacity
                      style={[s.termsRow, isAr && s.rowRtl]}
                      onPress={() => setAgreedTerms(a => !a)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.checkbox, agreedTerms && s.checkboxChecked]}>
                        {agreedTerms && <Text style={s.checkmark}>✓</Text>}
                      </View>
                      <Text style={[s.termsText, isAr && s.rtl,
                        { fontFamily: isAr ? F.ar : F.en }]}>
                        {t.termsRow}
                      </Text>
                    </TouchableOpacity>

                    {!!suError && (
                      <Text style={[s.error, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                        {suError}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[s.btnPrimary, suLoading && s.btnDisabled]}
                      onPress={handleSignUp} disabled={suLoading} activeOpacity={0.85}
                    >
                      {suLoading
                        ? <ActivityIndicator color={C.bgBase} />
                        : <Text style={[s.btnPrimaryText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                            {signupRole === 'buyer' ? t.signUpBtn : t.submitBtn}
                          </Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, style, isRtl, ...rest }) {
  return (
    <View style={[s.fieldWrap, style]}>
      <Text style={[s.fieldLabel, isRtl && s.rtl]}>{label}</Text>
      <TextInput
        style={[s.input, isRtl && { textAlign: 'right' }]}
        placeholderTextColor={C.textDisabled}
        textAlign={isRtl ? 'right' : 'left'}
        {...rest}
      />
    </View>
  );
}

// ── City chips helper ─────────────────────────────────────────────────────────
function CityChips({ cities, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipStrip}
      style={{ marginTop: 8 }}
    >
      {cities.map((city, i) => (
        <TouchableOpacity
          key={i}
          style={s.chip}
          onPress={() => onSelect(city)}
          activeOpacity={0.75}
        >
          <Text style={s.chipText}>{city}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 52 },
  rtl:    { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },
  row:    { flexDirection: 'row', gap: 10 },

  logoRow: { alignItems: 'center', marginBottom: 32 },

  // Tab strip
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingBottom: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.textPrimary,
    marginBottom: -1,
  },
  tabText: {
    color: C.textSecondary,
    fontSize: 15,
  },
  tabTextActive: {
    color: C.textPrimary,
  },

  // Card
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 20,
    gap: 16,
  },

  // Fields
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
  },
  input: {
    backgroundColor: C.bgOverlay,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: C.textPrimary,
    fontSize: 15,
  },

  error: { color: C.red, fontSize: 13 },

  // Primary button — white, no purple
  btnPrimary: {
    backgroundColor: C.btnPrimary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: {
    color: C.btnPrimaryText,
    fontSize: 16,
  },
  btnDisabled: { opacity: 0.55 },

  // Google button
  btnGoogle: {
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  btnGoogleText: {
    color: C.textPrimary,
    fontSize: 15,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.borderSubtle },
  dividerLabel: { color: C.textTertiary, fontSize: 13 },

  // Switch row
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  switchLabel: { color: C.textSecondary, fontSize: 14 },
  switchLink:  { color: C.textPrimary,   fontSize: 14 },

  // Role selection
  rolePrompt: {
    color: C.textSecondary,
    fontSize: 13,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 16,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    backgroundColor: C.bgRaised,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderDefault,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  roleCardTitle: {
    color: C.textPrimary,
    fontSize: 18,
    textAlign: 'center',
  },
  roleCardSub: {
    color: C.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Back button — dim white, no purple
  backBtn:  { marginBottom: 16 },
  backText: { color: C.textSecondary, fontSize: 14 },

  // Supplier hint box
  hintBox: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 12,
    marginBottom: 16,
  },
  hintText: { color: C.textTertiary, fontSize: 12, lineHeight: 18 },

  // Terms row
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: C.btnPrimary,
    borderColor: C.btnPrimary,
  },
  checkmark: {
    color: C.bgBase,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  termsText: {
    color: C.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // City chips
  chipStrip: { gap: 8, paddingRight: 4 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 16,
  },
  chipText: {
    color: C.textSecondary,
    fontFamily: F.en,
    fontSize: 12,
  },

  // Success
  successBox: {
    paddingTop: 24,
    paddingBottom: 8,
    gap: 24,
    alignItems: 'center',
  },
  successText: {
    color: C.textPrimary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
});
