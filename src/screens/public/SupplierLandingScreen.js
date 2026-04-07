import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';

// ── Copy (matches web T object exactly) ────────────────────────────────────
const T = {
  ar: {
    tag: 'مَعبر للموردين',
    title: 'وصّل منتجك\nللسوق السعودي',
    sub: 'بوابة تأسيسية أوضح للموردين الصينيين: سجّل الشركة، أضف رابط متجرك، ثم ادخل إلى لوحة المورد لإكمال التحقق ومتابعة الحالة بخطوات واضحة بدل الغموض.',
    cta: 'انضم كمورد مجاناً ←',
    learnMore: 'برنامج المورد التأسيسي ←',
    statLabel: 'طلب مفتوح الآن',
    whyLabel: 'لماذا مَعبر',
    trustTitle: 'ما الذي يتوقعه المورد الصيني هنا؟',
    flowTitle: 'كيف تسير العملية',
    flowSteps: [
      '1) تسجيل أساسي للشركة + رابط تجاري',
      '2) تأكيد البريد الإلكتروني',
      '3) دخول مباشر إلى لوحة المورد لإكمال التحقق',
      '4) متابعة من فريق مَعبر إذا لزم توضيح أو عند الموافقة',
    ],
    trustItems: [
      'لا نطلب الرخصة أو صور المصنع في أول شاشة تسجيل — فقط الأساسيات الموثوقة.',
      'روابط Alibaba / 1688 / الموقع الرسمي مقبولة كمصدر ثقة أولي.',
      'WeChat اختياري لكنه مفيد إذا كان هذا مسار التواصل المعتاد لديك.',
      'بعد تأكيد البريد تدخل مباشرة إلى لوحة المورد لتكمل التحقق وتتابع الحالة بشكل واضح.',
    ],
    features: [
      { icon: '01', t: 'شوف الطلبات مباشرة', d: 'المشترون يحددون وش يبون، الكمية، والمواصفات — وأنت ترد بعرض مهني واضح.' },
      { icon: '02', t: 'قدّم عرضاً احترافياً', d: 'أضف السعر وMOQ ومدة التسليم والشحن والملاحظات التجارية بطريقة أوضح للمشتري.' },
      { icon: '03', t: 'دفع موثّق', d: 'إتمام الصفقة عبر مَعبر يعطي حماية أفضل للتوثيق والدفع والتواصل.' },
    ],
    bottomTitle: 'جاهز تبدأ؟',
    copyright: 'مَعبر © 2026',
  },
  en: {
    tag: 'Maabar for Suppliers',
    title: 'Reach the\nSaudi Market',
    sub: 'A clearer founding-supplier entry for Chinese exporters: register the company, add your store link, then enter the supplier dashboard to complete verification and track status with less ambiguity.',
    cta: 'Join as Supplier — Free →',
    learnMore: 'Founding Supplier Program →',
    statLabel: 'open requests now',
    whyLabel: 'Why Maabar',
    trustTitle: 'What Chinese suppliers usually want to know first',
    flowTitle: 'How the flow works',
    flowSteps: [
      '1) Submit basic company details + a trade link',
      '2) Confirm your email',
      '3) Land directly in the supplier dashboard to continue verification',
      '4) Maabar follows up directly if clarification is needed or once approved',
    ],
    trustItems: [
      'Initial signup stays light — no business license upload on the first screen.',
      'Alibaba / 1688 / official company website links are accepted as first-pass trade proof.',
      'WeChat is optional, but recommended if it is your normal business channel.',
      'After email confirmation, you land in the supplier dashboard to continue verification and see a clearer review state.',
    ],
    features: [
      { icon: '01', t: 'See requests directly', d: 'Buyers specify quantity, specs, and budget direction — you respond with a cleaner commercial quote.' },
      { icon: '02', t: 'Quote more professionally', d: 'Present MOQ, lead time, shipping, and trade notes in a way that feels closer to a real RFQ workflow.' },
      { icon: '03', t: 'Protected deal flow', d: 'Closing the transaction on Maabar keeps payment, records, and communication more structured.' },
    ],
    bottomTitle: 'Ready to start?',
    copyright: 'Maabar © 2026',
  },
  zh: {
    tag: 'Maabar 供应商平台',
    title: '进入\n沙特市场',
    sub: '更清晰的中国供应商入驻路径：先提交公司基础资料和店铺链接，再进入供应商控制台继续完成认证并清楚查看状态，不再靠猜测审核进度。',
    cta: '免费加入供应商 →',
    learnMore: '创始供应商计划 →',
    statLabel: '个开放询价',
    whyLabel: '为什么选择 Maabar',
    trustTitle: '中国供应商最关心的几点',
    flowTitle: '流程怎么走',
    flowSteps: [
      '1) 提交公司基础资料 + 店铺链接',
      '2) 确认邮箱',
      '3) 直接进入供应商控制台继续认证',
      '4) 如需补充资料或审核通过，Maabar 团队会直接联系您',
    ],
    trustItems: [
      '首次注册保持轻量，不会在第一屏就要求上传完整营业执照。',
      '支持 Alibaba / 1688 / 官网链接作为第一步贸易证明。',
      'WeChat 不是必填，但如果这是您的常用商务渠道，建议填写。',
      '邮箱确认后，系统会直接带您进入供应商控制台继续认证，并更清楚地显示审核状态。',
    ],
    features: [
      { icon: '01', t: '直接查看询价', d: '买家会写明数量、规格和采购方向，您可直接提交更专业的报价。' },
      { icon: '02', t: '报价更像正式 RFQ', d: '更清楚地填写 MOQ、交期、运费和商业备注，让买家更容易比较。' },
      { icon: '03', t: '交易更有保障', d: '通过 Maabar 完成沟通与交易，付款、记录和流程都会更清晰。' },
    ],
    bottomTitle: '准备好开始了吗？',
    copyright: 'Maabar © 2026',
  },
};

const LANG_BTNS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع' },
];

export default function SupplierLandingScreen({ navigation }) {
  // Default zh — this screen targets Chinese suppliers
  const [lang, setLang] = useState('zh');
  const [count, setCount] = useState(null);

  const t = T[lang] || T.zh;
  const isAr = lang === 'ar';
  const bodyFont = isAr ? F.ar : F.en;
  const boldFont = isAr ? F.arBold : F.enBold;
  const semiFont = isAr ? F.arSemi : F.enSemi;

  useEffect(() => {
    // Exact web query from SupplierLanding.jsx useEffect
    supabase
      .from('requests')
      .select('id', { count: 'exact' })
      .eq('status', 'open')
      .then(({ count: c, data, error }) => {
        console.log('[SupplierLanding] open requests count:', c, 'error:', error);
        if (c != null) setCount(c);
      });
  }, []);

  const goRegister = () => navigation.navigate('SignupSupplier');
  const goAccess   = () => navigation.navigate('SupplierAccess', { lang });

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <MaabarLogo size="md" />
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

        {/* ── Hero ── */}
        <View style={[s.hero, isAr && s.heroRtl]}>
          <Text style={[s.tag, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.tag}
          </Text>
          <Text style={[s.title, { fontFamily: boldFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.title}
          </Text>
          <Text style={[s.sub, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.sub}
          </Text>

          {/* Stat pill */}
          <View style={[s.statPill, isAr && { flexDirection: 'row-reverse' }]}>
            <Text style={[s.statNum, { fontFamily: F.enBold }]}>
              {count != null ? count : '—'}
            </Text>
            <Text style={[s.statLabel, { fontFamily: bodyFont }]}>
              {t.statLabel}
            </Text>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity style={s.ctaBtn} onPress={goRegister} activeOpacity={0.85}>
            <Text style={[s.ctaBtnText, { fontFamily: semiFont }]}>{t.cta}</Text>
          </TouchableOpacity>

          {/* Secondary: Learn more → SupplierAccess */}
          <TouchableOpacity style={s.learnMoreBtn} onPress={goAccess} activeOpacity={0.75}>
            <Text style={[s.learnMoreText, { fontFamily: semiFont }]}>{t.learnMore}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Trust card ── */}
        <View style={s.card}>
          <Text style={[s.cardLabel, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.trustTitle}
          </Text>
          {t.trustItems.map((item, i) => (
            <View key={i} style={[s.bulletRow, isAr && s.bulletRowRtl]}>
              <View style={s.bullet} />
              <Text style={[s.bulletText, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Flow card ── */}
        <View style={s.card}>
          <Text style={[s.cardLabel, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.flowTitle}
          </Text>
          {t.flowSteps.map((step, i) => (
            <View key={i} style={[s.stepRow, isAr && s.stepRowRtl]}>
              <View style={s.stepNumWrap}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[s.stepText, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Features ── */}
        <View style={s.featuresWrap}>
          <Text style={[s.sectionLabel, { fontFamily: semiFont }]}>{t.whyLabel}</Text>
          {t.features.map((f, i) => (
            <View key={i} style={s.featureCard}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={[s.featureTitle, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
                {f.t}
              </Text>
              <Text style={[s.featureDesc, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                {f.d}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Bottom CTA ── */}
        <View style={s.bottomWrap}>
          <Text style={[s.bottomTitle, { fontFamily: boldFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.bottomTitle}
          </Text>
          <TouchableOpacity style={s.ctaBtn} onPress={goRegister} activeOpacity={0.85}>
            <Text style={[s.ctaBtnText, { fontFamily: semiFont }]}>{t.cta}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <MaabarLogo size="md" />
          <Text style={s.copyright}>{t.copyright}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  scroll: { paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised,
  },
  langBtnActive: { borderColor: C.borderStrong, backgroundColor: C.bgHover },
  langBtnText: { fontSize: 11, fontFamily: F.enSemi, color: C.textDisabled },
  langBtnTextActive: { color: C.textPrimary },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 8 },
  heroRtl: { alignItems: 'flex-end' },
  tag: {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 12,
  },
  title: {
    fontSize: 38, lineHeight: 46, color: C.textPrimary,
    marginBottom: 14,
  },
  sub: {
    fontSize: 14, lineHeight: 22, color: C.textSecondary,
    marginBottom: 20,
  },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderDefault,
    paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'flex-start', marginBottom: 20,
  },
  statNum: { fontSize: 28, color: C.textPrimary, lineHeight: 32 },
  statLabel: { fontSize: 12, color: C.textSecondary },

  ctaBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10,
  },
  ctaBtnText: { color: C.btnPrimaryText, fontSize: 15 },
  learnMoreBtn: { alignItems: 'center', paddingVertical: 8 },
  learnMoreText: { color: C.textSecondary, fontSize: 13 },

  // Cards
  card: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: C.bgRaised, borderRadius: 18,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 18, gap: 10,
  },
  cardLabel: {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 4,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletRowRtl: { flexDirection: 'row-reverse' },
  bullet: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.textSecondary, marginTop: 7, flexShrink: 0,
  },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 21, color: C.textSecondary },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepRowRtl: { flexDirection: 'row-reverse' },
  stepNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderDefault,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { color: C.textSecondary, fontSize: 10, fontFamily: F.enSemi },
  stepText: { flex: 1, fontSize: 13, lineHeight: 21, color: C.textSecondary },

  // Features
  featuresWrap: { paddingHorizontal: 16, marginTop: 20 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 12, paddingHorizontal: 2,
  },
  featureCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 16, marginBottom: 8,
  },
  featureIcon: {
    fontSize: 10, letterSpacing: 2, color: C.textDisabled,
    fontFamily: F.enSemi, marginBottom: 8,
  },
  featureTitle: { fontSize: 15, color: C.textPrimary, marginBottom: 6 },
  featureDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  // Bottom
  bottomWrap: { paddingHorizontal: 20, marginTop: 28 },
  bottomTitle: { fontSize: 28, color: C.textPrimary, marginBottom: 16 },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  copyright: { color: C.textDisabled, fontSize: 11, fontFamily: F.en },
});
