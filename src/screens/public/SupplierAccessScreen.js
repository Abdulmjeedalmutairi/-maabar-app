import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCESS_DEADLINE = '2026-05-01T23:59:59Z';
const TOTAL_SPOTS     = 10;
const SPOTS_LEFT      = 8;

function getTimeLeft() {
  const diff = new Date(ACCESS_DEADLINE).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

// Derive CTA mode from supplier profile status (mirrors web getSupplierOnboardingState logic)
function deriveCtaMode(profile) {
  if (!profile || profile.role !== 'supplier') return 'apply';
  const status = String(profile.status || 'registered').trim().toLowerCase();
  if (['verified', 'active', 'approved', 'inactive', 'disabled', 'suspended'].includes(status))
    return 'dashboard';
  if (['verification_under_review', 'pending', 'under_review', 'submitted', 'review'].includes(status))
    return 'review';
  // registered / draft / incomplete / verification_required
  return 'continue';
}

// ─── Copy (ar / en / zh) ─────────────────────────────────────────────────────
const T = {
  zh: {
    badge:          '创始供应商计划',
    title:          '沙特市场正在等待\n率先抢占先机',
    sub:            '我们正在甄选经过认证的供应商，提前进入沙特市场——现在上传产品，正式上线第一天即可开始销售。',
    countdownLabel: '距正式上线',
    spots:          `仅剩 ${SPOTS_LEFT} / ${TOTAL_SPOTS} 个名额`,
    whatYouGet:     '您将获得',
    howItWorks:     '流程说明',
    cta: {
      apply:     '立即申请 →',
      continue:  '继续申请',
      review:    '查看申请状态',
      dashboard: '打开供应商控制台',
    },
    signIn:      '已通过审核？登录',
    disclaimer:  '审核需 24 至 72 小时 · 名额有限',
    footerLine1: 'maabar.io · info@maabar.io',
    footerLine2: '沙特阿拉伯 × 中国',
    timeUnits:   { days: '天', hours: '时', minutes: '分', seconds: '秒' },
    benefits: [
      { title: '零佣金',           desc: '所有交易零手续费，创始供应商无任何抽成。' },
      { title: '直接触达沙特买家', desc: '沙特每年从中国进口超 1000 亿美元商品，Maabar 直接帮您建立连接。' },
      { title: '优先展示',         desc: '自正式上线起，您的产品将优先出现在搜索结果和品类列表中。' },
    ],
    steps: [
      '提交申请',
      '通过创始供应商审核',
      '上传产品并完善资料',
      '正式上线当天产品即上架',
      '立即开始接收沙特商家询价',
    ],
  },
  en: {
    badge:          'Founding Supplier Program',
    title:          'The Saudi market is waiting.\nBe first to reach it.',
    sub:            'We are selecting verified suppliers for early access to the Saudi market — upload your products now and go live from day one.',
    countdownLabel: 'Official launch in',
    spots:          `${SPOTS_LEFT} of ${TOTAL_SPOTS} spots remaining in your category`,
    whatYouGet:     'What you get',
    howItWorks:     'How it works',
    cta: {
      apply:     'APPLY NOW →',
      continue:  'Continue Application',
      review:    'View Application Status',
      dashboard: 'Open Supplier Dashboard',
    },
    signIn:      'Already approved? Sign in',
    disclaimer:  'Review takes 24 to 72 hours · Limited spots available',
    footerLine1: 'maabar.io · info@maabar.io',
    footerLine2: 'Saudi Arabia × China',
    timeUnits:   { days: 'DAYS', hours: 'HRS', minutes: 'MIN', seconds: 'SEC' },
    benefits: [
      { title: '0% Commission',              desc: 'No fees on any transaction. Zero cuts for founding suppliers.' },
      { title: 'Direct Access to Saudi Buyers', desc: 'Saudi Arabia imports $100B annually from China. Maabar connects you directly.' },
      { title: 'Priority Placement',         desc: 'Your products appear first in search results and category listings from launch day.' },
    ],
    steps: [
      'Submit your application',
      'Get approved as a Founding Supplier',
      'Upload your products and prepare your profile',
      'Your products go live on launch day',
      'Start receiving requests from Saudi merchants immediately',
    ],
  },
  ar: {
    badge:          'برنامج المورد التأسيسي',
    title:          'السوق السعودي ينتظر\nكن الأول للوصول إليه',
    sub:            'نختار موردين موثّقين للوصول المبكر للسوق السعودي — ارفع منتجاتك الآن وكن حاضراً من أول يوم إطلاق.',
    countdownLabel: 'الإطلاق الرسمي بعد',
    spots:          `${SPOTS_LEFT} من أصل ${TOTAL_SPOTS} مقاعد متبقية في فئتك`,
    whatYouGet:     'ما تحصل عليه',
    howItWorks:     'كيف تسير العملية',
    cta: {
      apply:     'سجّل الآن ←',
      continue:  'متابعة الطلب',
      review:    'عرض حالة الطلب',
      dashboard: 'فتح لوحة المورد',
    },
    signIn:      'سبق وتمت الموافقة؟ سجّل دخولك',
    disclaimer:  'المراجعة تستغرق من 24 إلى 72 ساعة · المقاعد محدودة',
    footerLine1: 'maabar.io · info@maabar.io',
    footerLine2: 'السعودية × الصين',
    timeUnits:   { days: 'يوم', hours: 'ساعة', minutes: 'دقيقة', seconds: 'ثانية' },
    benefits: [
      { title: 'عمولة 0٪',              desc: 'لا رسوم على أي صفقة — الموردون التأسيسيون لا يدفعون أي نسبة.' },
      { title: 'وصول مباشر لمشترين سعوديين', desc: 'السعودية تستورد أكثر من 100 مليار دولار سنوياً من الصين — مَعبر يربطك بهم مباشرة.' },
      { title: 'ظهور أولي مميز',        desc: 'منتجاتك تظهر في أعلى نتائج البحث والتصنيفات من يوم الإطلاق.' },
    ],
    steps: [
      'أرسل طلبك',
      'احصل على موافقة كمورد تأسيسي',
      'ارفع منتجاتك وجهّز ملفك التجاري',
      'تُعرض منتجاتك فور إطلاق المنصة',
      'ابدأ في استقبال طلبات المشترين السعوديين فوراً',
    ],
  },
};

const LANG_BTNS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function SupplierAccessScreen({ navigation, route }) {
  const [lang, setLang]       = useState(route?.params?.lang || 'zh');
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());
  const [ctaMode, setCtaMode] = useState('apply');

  const t        = T[lang] || T.zh;
  const isAr     = lang === 'ar';
  const bodyFont = isAr ? F.ar   : F.en;
  const boldFont = isAr ? F.arBold : F.enBold;
  const semiFont = isAr ? F.arSemi : F.enSemi;

  // Countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Session check — adapt CTA label like web SupplierAccess.jsx
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[SupplierAccess] session userId:', session?.user?.id ?? null);
      if (!session) return; // no session → stays 'apply'

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', session.user.id)
        .single();

      console.log('[SupplierAccess] profile:', profile, 'error:', error);
      if (profile) setCtaMode(deriveCtaMode(profile));
    });
  }, []);

  const fmt = (v) => String(v).padStart(2, '0');

  const timeItems = [
    { v: fmt(timeLeft.days),    l: t.timeUnits.days    },
    { v: fmt(timeLeft.hours),   l: t.timeUnits.hours   },
    { v: fmt(timeLeft.minutes), l: t.timeUnits.minutes },
    { v: fmt(timeLeft.seconds), l: t.timeUnits.seconds },
  ];

  const handleCta = () => {
    if (ctaMode === 'apply') {
      navigation.navigate('SignupSupplier');
    } else {
      // continue / review / dashboard — user has an account, send to Login
      navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Nav ── */}
      <View style={[s.nav, isAr && s.rowRtl]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}>
          <MaabarLogo size="sm" />
        </TouchableOpacity>
        <View style={[s.navRight, isAr && s.rowRtl]}>
          <View style={s.langRow}>
            {LANG_BTNS.map(lb => (
              <TouchableOpacity
                key={lb.code}
                style={[s.langBtn, lang === lb.code && s.langBtnActive]}
                onPress={() => setLang(lb.code)}
                activeOpacity={0.75}
              >
                <Text style={[s.langBtnText, lang === lb.code && s.langBtnTextActive]}>
                  {lb.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={[s.badge, isAr && s.badgeRtl]}>
            <Text style={[s.badgeText, { fontFamily: F.enBold }]}>{t.badge}</Text>
          </View>
          <Text style={[s.title, { fontFamily: boldFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.title}
          </Text>
          <Text style={[s.sub, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.sub}
          </Text>
        </View>

        {/* ── Countdown ── */}
        <View style={s.countdownCard}>
          <Text style={[s.countdownLabel, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.countdownLabel}
          </Text>
          <View style={[s.countdownRow, isAr && s.rowRtl]}>
            {timeItems.map(({ v, l }) => (
              <View key={l} style={s.timeUnit}>
                <Text style={[s.timeNum, { fontFamily: F.enBold }]}>{v}</Text>
                <Text style={[s.timeLabel, { fontFamily: F.enSemi }]}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Spots warning ── */}
        <View style={[s.spotsRow, isAr && s.rowRtl]}>
          <Text style={s.spotsIcon}>⚠️</Text>
          <Text style={[s.spotsText, { fontFamily: semiFont }]}>{t.spots}</Text>
        </View>

        {/* ── Benefits ── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.whatYouGet}
          </Text>
          <View style={s.card}>
            {t.benefits.map((b, i) => (
              <View key={b.title}>
                <View style={s.benefitRow}>
                  <Text style={[s.benefitTitle, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
                    {b.title}
                  </Text>
                  <Text style={[s.benefitDesc, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                    {b.desc}
                  </Text>
                </View>
                {i < t.benefits.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.howItWorks}
          </Text>
          <View style={s.card}>
            {t.steps.map((step, i) => (
              <View key={i} style={[s.stepRow, isAr && s.rowRtl]}>
                <View style={s.stepNumWrap}>
                  <Text style={[s.stepNum, { fontFamily: F.enBold }]}>{String(i + 1).padStart(2, '0')}</Text>
                </View>
                <Text style={[s.stepText, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={s.ctaSection}>
          <TouchableOpacity style={s.ctaBtn} onPress={handleCta} activeOpacity={0.85}>
            <Text style={[s.ctaBtnText, { fontFamily: semiFont }]}>{t.cta[ctaMode]}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.signInLink} onPress={() => navigation.navigate('Login')} activeOpacity={0.75}>
            <Text style={[s.signInText, { fontFamily: bodyFont }]}>{t.signIn}</Text>
          </TouchableOpacity>
          <Text style={[s.disclaimer, { fontFamily: bodyFont }]}>{t.disclaimer}</Text>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>{t.footerLine1}</Text>
          <Text style={s.footerText}>{t.footerLine2}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  scroll: { paddingBottom: 56 },
  rowRtl: { flexDirection: 'row-reverse' },

  // Nav
  nav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  navRight:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  langRow:    { flexDirection: 'row', gap: 6 },
  langBtn:    {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised,
  },
  langBtnActive:     { borderColor: C.borderStrong, backgroundColor: C.bgHover },
  langBtnText:       { fontSize: 11, fontFamily: F.enSemi, color: C.textDisabled },
  langBtnTextActive: { color: C.textPrimary },

  // Hero
  hero:  { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 8 },
  badge: { flexDirection: 'row', marginBottom: 18 },
  badgeRtl: { flexDirection: 'row-reverse' },
  badgeText: {
    backgroundColor: C.textPrimary, color: C.bgBase,
    fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4,
  },
  title: {
    fontSize: 34, lineHeight: 42, color: C.textPrimary,
    marginBottom: 14,
  },
  sub: {
    fontSize: 15, lineHeight: 24, color: C.textSecondary,
    marginBottom: 8,
  },

  // Countdown
  countdownCard: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 20,
  },
  countdownLabel: {
    fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 14,
  },
  countdownRow: { flexDirection: 'row', gap: 24, alignItems: 'flex-end' },
  timeUnit:     { alignItems: 'center', gap: 4 },
  timeNum:      { fontSize: 38, lineHeight: 40, color: C.textPrimary, letterSpacing: -1 },
  timeLabel:    { fontSize: 10, color: C.textDisabled, letterSpacing: 1 },

  // Spots
  spotsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 14,
  },
  spotsIcon: { fontSize: 14 },
  spotsText: { fontSize: 13, color: C.orange },

  // Sections
  section:      { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 10,
  },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: C.borderSubtle },

  // Benefits
  benefitRow:   { padding: 16 },
  benefitTitle: { fontSize: 14, color: C.textPrimary, marginBottom: 4 },
  benefitDesc:  { fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  // Steps
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  stepNumWrap: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderDefault,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNum:  { fontSize: 10, color: C.textDisabled },
  stepText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 20, paddingTop: 4 },

  // CTA
  ctaSection: { paddingHorizontal: 20, marginTop: 32, gap: 12 },
  ctaBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaBtnText: { color: C.btnPrimaryText, fontSize: 15, letterSpacing: 0.5 },
  signInLink: { alignItems: 'center', paddingVertical: 4 },
  signInText: { color: C.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
  disclaimer: { textAlign: 'center', fontSize: 12, color: C.textDisabled, lineHeight: 18 },

  // Footer
  footer: {
    alignItems: 'center', marginTop: 40, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: C.borderSubtle, gap: 4,
  },
  footerText: { color: C.textDisabled, fontSize: 11, fontFamily: F.en },
});
