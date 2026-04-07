import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// ── Copy (copied exactly from web Contact.jsx T object) ───────────────────────
const T = {
  ar: {
    title:      'تواصل معنا',
    sub:        'نحن هنا للمساعدة.',
    wa:         'واتساب',
    email:      'البريد الإلكتروني',
    support:    'الدعم الذكي 24/7',
    supportSub: 'ابدأ مع وكيل معبر للدعم الفوري داخل المنصة',
    supportBtn: 'افتح الدعم',
  },
  en: {
    title:      'Contact Us',
    sub:        'We are here to help.',
    wa:         'WhatsApp',
    email:      'Email',
    support:    'AI Support 24/7',
    supportSub: 'Start with وكيل معبر for instant help inside the platform',
    supportBtn: 'Open Support',
  },
  zh: {
    title:      '联系我们',
    sub:        '我们随时为您提供帮助。',
    wa:         'WhatsApp',
    email:      '电子邮件',
    support:    '24/7 智能支持',
    supportSub: '通过 وكيل معبر 立即获得平台内协助',
    supportBtn: '打开支持',
  },
};

export default function ContactScreen({ navigation }) {
  const lang = getLang();
  const t    = T[lang] || T.ar;
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Page title ── */}
        <View style={[s.titleWrap, isAr && { alignItems: 'flex-end' }]}>
          <Text style={[s.pageTitle, { fontFamily: boldFont }]}>{t.title}</Text>
          <Text style={[s.pageSub, { fontFamily: bodyFont }]}>{t.sub}</Text>
        </View>

        {/* ── Contact cards ── */}
        <View style={s.cards}>

          {/* Support — navigates to SupportScreen (no purple per design rule) */}
          <TouchableOpacity
            style={[s.card, isAr && s.cardRtl]}
            onPress={() => navigation.navigate('Support')}
            activeOpacity={0.8}
          >
            <View style={[s.cardBody, isAr && { alignItems: 'flex-end' }]}>
              <Text style={[s.cardKicker, { fontFamily: bodyFont }]}>{t.support}</Text>
              <Text style={[s.cardValue, { fontFamily: semiFont }]}>{t.supportBtn}</Text>
              <Text style={[s.cardSub, { fontFamily: bodyFont }]}>{t.supportSub}</Text>
            </View>
            <Text style={[s.arrow, isAr && s.arrowRtl]}>›</Text>
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity
            style={[s.card, isAr && s.cardRtl]}
            onPress={openWhatsApp}
            activeOpacity={0.8}
          >
            <View style={[s.cardBody, isAr && { alignItems: 'flex-end' }]}>
              <Text style={[s.cardKicker, { fontFamily: bodyFont }]}>{t.wa}</Text>
              <Text style={[s.cardValue, { fontFamily: F.enSemi }]}>+966 50 424 8942</Text>
            </View>
            <Text style={[s.arrow, isAr && s.arrowRtl]}>›</Text>
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity
            style={[s.card, isAr && s.cardRtl]}
            onPress={openEmail}
            activeOpacity={0.8}
          >
            <View style={[s.cardBody, isAr && { alignItems: 'flex-end' }]}>
              <Text style={[s.cardKicker, { fontFamily: bodyFont }]}>{t.email}</Text>
              <Text style={[s.cardValue, { fontFamily: F.en }]}>support@maabar.io</Text>
            </View>
            <Text style={[s.arrow, isAr && s.arrowRtl]}>›</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
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

  // Title block
  titleWrap: { padding: 24, paddingBottom: 8 },
  pageTitle: { fontSize: 34, color: C.textPrimary, marginBottom: 6 },
  pageSub:   { fontSize: 15, color: C.textSecondary },

  // Cards
  cards: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bgRaised, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 20, gap: 16,
  },
  cardRtl:    { flexDirection: 'row-reverse' },
  cardBody:   { flex: 1 },
  cardKicker: {
    fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
    color: C.textSecondary, marginBottom: 4,
  },
  cardValue:  { fontSize: 15, color: C.textPrimary, marginBottom: 2 },
  cardSub:    { fontSize: 12, color: C.textSecondary, lineHeight: 18, marginTop: 2 },
  arrow:      { color: C.textDisabled, fontSize: 22 },
  arrowRtl:   { transform: [{ scaleX: -1 }] },
});
