import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// ── Copy (matches web FAQ.jsx T object exactly) ───────────────────────────────
const T = {
  ar: {
    eyebrow:      'مَعبر · مركز المساعدة',
    title:        'الأسئلة الشائعة',
    intro:        'اختر المسار المناسب لك للوصول إلى إجابات واضحة ومختصرة حسب دورك داخل المنصة.',
    traderTitle:  'أسئلة التاجر',
    traderText:   'كل ما يحتاجه التاجر عن الطلبات، الدفع، مقارنة العروض، الشحن، والتواصل مع الموردين.',
    supplierTitle:'أسئلة المورد',
    supplierText: 'إجابات خاصة بالموردين حول التسجيل، التحقق، العروض، المدفوعات، وما الذي يحدث بعد المراجعة.',
    traderCta:    'اذهب إلى أسئلة التاجر',
    supplierCta:  'اذهب إلى أسئلة المورد',
    termsLabel:   'تحتاج الشروط والأحكام؟',
    termsCta:     'افتح الشروط والأحكام',
  },
  en: {
    eyebrow:      'Maabar · Help Center',
    title:        'Frequently Asked Questions',
    intro:        'Choose the path that fits your role to get clear, focused answers without clutter.',
    traderTitle:  'Trader FAQ',
    traderText:   'Everything traders need to know about requests, payments, comparing offers, shipping, and supplier communication.',
    supplierTitle:'Supplier FAQ',
    supplierText: 'Role-specific answers for suppliers covering registration, verification, quoting, payouts, and review status.',
    traderCta:    'Open Trader FAQ',
    supplierCta:  'Open Supplier FAQ',
    termsLabel:   'Need the legal page too?',
    termsCta:     'Open Terms & Conditions',
  },
  zh: {
    eyebrow:      'Maabar · 帮助中心',
    title:        '常见问题',
    intro:        '请选择适合您身份的入口，查看更清晰、更聚焦的常见问题解答。',
    traderTitle:  '贸易商常见问题',
    traderText:   '面向贸易商的说明：需求发布、付款、比价、运输以及与供应商沟通。',
    supplierTitle:'供应商常见问题',
    supplierText: '面向供应商的说明：注册、认证、报价、收款以及审核期间会发生什么。',
    traderCta:    '打开贸易商 FAQ',
    supplierCta:  '打开供应商 FAQ',
    termsLabel:   '还需要法律条款页面？',
    termsCta:     '打开条款与条件',
  },
};

export default function FAQScreen({ navigation }) {
  const lang = getLang();
  const t    = T[lang] || T.ar;
  const isAr = lang === 'ar';
  const bodyFont = isAr ? F.ar   : F.en;
  const boldFont = isAr ? F.arBold : F.enBold;
  const semiFont = isAr ? F.arSemi : F.enSemi;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={[s.eyebrow, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.eyebrow}
          </Text>
          <Text style={[s.title, { fontFamily: boldFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.title}
          </Text>
          <Text style={[s.intro, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.intro}
          </Text>
        </View>

        {/* ── Role cards ── */}
        <View style={s.cards}>
          <RoleCard
            title={t.traderTitle}
            text={t.traderText}
            cta={t.traderCta}
            onPress={() => navigation.navigate('FAQTraders')}
            isAr={isAr}
            semiFont={semiFont}
            bodyFont={bodyFont}
          />
          <RoleCard
            title={t.supplierTitle}
            text={t.supplierText}
            cta={t.supplierCta}
            onPress={() => navigation.navigate('FAQSuppliers')}
            isAr={isAr}
            semiFont={semiFont}
            bodyFont={bodyFont}
          />
        </View>

        {/* ── Terms footer bar ── */}
        <View style={[s.termsBar, isAr && s.rowRtl]}>
          <Text style={[s.termsLabel, { fontFamily: bodyFont }]}>{t.termsLabel}</Text>
          <TouchableOpacity
            style={s.termsBtn}
            onPress={() => navigation.navigate('Terms')}
            activeOpacity={0.8}
          >
            <Text style={[s.termsBtnText, { fontFamily: semiFont }]}>{t.termsCta}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function RoleCard({ title, text, cta, onPress, isAr, semiFont, bodyFont }) {
  return (
    <View style={s.card}>
      <Text style={[s.cardTitle, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
        {title}
      </Text>
      <Text style={[s.cardText, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
        {text}
      </Text>
      <TouchableOpacity style={s.cardCta} onPress={onPress} activeOpacity={0.85}>
        <Text style={[s.cardCtaText, { fontFamily: semiFont }]}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  scroll: { paddingBottom: 48 },
  rowRtl: { flexDirection: 'row-reverse' },

  // Hero
  hero: {
    backgroundColor: C.bgSubtle,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    padding: 24, paddingTop: 32,
  },
  eyebrow: {
    fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
    color: C.textTertiary, marginBottom: 12,
  },
  title: {
    fontSize: 36, lineHeight: 42, color: C.textPrimary,
    marginBottom: 12,
  },
  intro: {
    fontSize: 14, lineHeight: 24, color: C.textSecondary,
  },

  // Cards
  cards: { padding: 16, gap: 12 },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 22,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 22,
  },
  cardTitle: { fontSize: 22, color: C.textPrimary, marginBottom: 10 },
  cardText:  { fontSize: 13, lineHeight: 22, color: C.textSecondary, marginBottom: 20 },
  cardCta: {
    backgroundColor: C.btnPrimary, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  cardCtaText: { color: C.btnPrimaryText, fontSize: 13 },

  // Terms bar
  termsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.bgOverlay, borderRadius: 18,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 16,
  },
  termsLabel: { fontSize: 13, color: C.textSecondary, flex: 1 },
  termsBtn: {
    borderRadius: 999, borderWidth: 1, borderColor: C.borderDefault,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  termsBtnText: { color: C.textPrimary, fontSize: 12 },
});
