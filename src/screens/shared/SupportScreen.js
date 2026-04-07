import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// ── Copy (matches web Support.jsx COPY object exactly, adds zh) ───────────────
const COPY = {
  ar: {
    kicker:   'دعم ذكي',
    title:    'دعم معبر 24/7',
    subtitle: 'وكيل معبر يساعدك فوراً في مشاكل الحسابات، الطلبات، الدفع، الموردين، الشحن، والترجمة التجارية.',
    wa:       'واتساب',
    waNum:    '+966 50 424 8942',
    email:    'البريد الإلكتروني',
    emailAddr:'support@maabar.io',
  },
  en: {
    kicker:   'AI Support',
    title:    'Maabar Support 24/7',
    subtitle: 'وكيل معبر helps immediately across accounts, orders, payments, suppliers, shipping, and trade translation.',
    wa:       'WhatsApp',
    waNum:    '+966 50 424 8942',
    email:    'Email',
    emailAddr:'support@maabar.io',
  },
  zh: {
    kicker:   'AI 支持',
    title:    'Maabar 24/7 支持',
    subtitle: 'وكيل معبر 可立即协助处理账户、订单、付款、供应商、物流与商务翻译问题。',
    wa:       'WhatsApp',
    waNum:    '+966 50 424 8942',
    email:    '电子邮件',
    emailAddr:'support@maabar.io',
  },
};

export default function SupportScreen({ navigation }) {
  const lang = getLang();
  const t    = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';
  const bodyFont = isAr ? F.ar   : F.en;
  const boldFont = isAr ? F.arBold : F.enBold;
  const semiFont = isAr ? F.arSemi : F.enSemi;

  const openWhatsApp = () => Linking.openURL('https://wa.me/966504248942');
  const openEmail    = () => Linking.openURL('mailto:support@maabar.io');

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={[s.header, isAr && s.rowRtl]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} activeOpacity={0.7}>
          <Text style={[s.back, isAr && s.backRtl]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { fontFamily: semiFont }]}>{t.title}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={[s.kicker, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.kicker}
          </Text>
          <Text style={[s.title, { fontFamily: boldFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.title}
          </Text>
          <Text style={[s.subtitle, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.subtitle}
          </Text>
        </View>

        {/* ── Contact rows ── */}
        <View style={s.contacts}>
          <ContactRow
            label={t.wa}
            value={t.waNum}
            onPress={openWhatsApp}
            isAr={isAr}
            bodyFont={bodyFont}
            semiFont={semiFont}
          />
          <ContactRow
            label={t.email}
            value={t.emailAddr}
            onPress={openEmail}
            isAr={isAr}
            bodyFont={bodyFont}
            semiFont={semiFont}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ label, value, onPress, isAr, bodyFont, semiFont }) {
  return (
    <TouchableOpacity
      style={[s.contactRow, isAr && s.contactRowRtl]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.contactText, isAr && { alignItems: 'flex-end' }]}>
        <Text style={[s.contactLabel, { fontFamily: bodyFont }]}>{label}</Text>
        <Text style={[s.contactValue, { fontFamily: semiFont }]}>{value}</Text>
      </View>
      <Text style={[s.contactArrow, isAr && s.contactArrowRtl]}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  scroll: { paddingBottom: 56 },
  rowRtl: { flexDirection: 'row-reverse' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    gap: 12,
  },
  back:         { color: C.textSecondary, fontSize: 22 },
  backRtl:      { transform: [{ scaleX: -1 }] },
  headerTitle:  { flex: 1, color: C.textPrimary, fontSize: 16, textAlign: 'center' },
  headerSpacer: { width: 22 },

  // Hero
  hero: { padding: 24, paddingTop: 28 },
  kicker: {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 12,
  },
  title:    { fontSize: 30, lineHeight: 36, color: C.textPrimary, marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 26, color: C.textSecondary },

  // Contact rows
  contacts: { paddingHorizontal: 16, gap: 8 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bgRaised, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 20, gap: 16,
  },
  contactRowRtl: { flexDirection: 'row-reverse' },
  contactText:   { flex: 1 },
  contactLabel:  { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.textSecondary, marginBottom: 4 },
  contactValue:  { fontSize: 15, color: C.textPrimary },
  contactArrow:  { color: C.textDisabled, fontSize: 22 },
  contactArrowRtl: { transform: [{ scaleX: -1 }] },
});
