import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';

const DIM = 'rgba(0,0,0,0.22)';

export default function PublicHomeScreen({ navigation }) {

  const goProducts      = () => navigation.navigate('Products');
  const goSuppliers     = () => navigation.navigate('Suppliers');
  const goLogin         = () => navigation.navigate('Login');
  const goNewRequest    = (mode) => navigation.navigate('NewRequest', { mode });
  const goIdeaToProduct = () => navigation.navigate('IdeaToProduct');
  const goFAQ           = () => navigation.navigate('FAQ');
  const goTerms         = () => navigation.navigate('Terms');
  const goContact       = () => navigation.navigate('Contact');

  return (
    <SafeAreaView style={s.safe}>

      {/* ── 1. Navbar ───────────────────────────────────────────────── */}
      <View style={s.navbar}>
        {/* Logo is absolutely centered so the login button width doesn't shift it */}
        <View style={[StyleSheet.absoluteFill, s.navCenter]} pointerEvents="none">
          <MaabarLogo />
        </View>
        <TouchableOpacity onPress={goLogin} activeOpacity={0.7}>
          <Text style={s.navLogin}>تسجيل / دخول</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 2. Hero ─────────────────────────────────────────────── */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>الحل لجميع مشاكل استيرادك من الصين</Text>
          <Text style={s.heroH1}>لا تبحث — مَعبر يبحث لك</Text>
          <Text style={s.heroSub}>استورد بثقة بدون وسطاء وبلا حاجز لغة</Text>
        </View>

        {/* ── 3. Browse cards ─────────────────────────────────────── */}
        <View style={s.browseRow}>
          <TouchableOpacity style={s.browseCard} onPress={goProducts} activeOpacity={0.78}>
            <Text style={s.browseTitle}>المنتجات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.browseCard} onPress={goSuppliers} activeOpacity={0.78}>
            <Text style={s.browseTitle}>الموردون</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Action cards (stacked, 1 px dividers, no outer border) */}
        <View style={s.actionBlock}>
          <ActionCard
            step="01"
            title="ارفع طلبك"
            sub="قدّم طلبك والموردون يتنافسون على تقديم أفضل عرض لك"
            onPress={() => goNewRequest('direct')}
          />
          <View style={s.actionDivider} />
          <ActionCard
            step="02"
            title="الطلب المُدار"
            sub="فريق مختص يتولى طلبك ويعرض لك أفضل 3 عروض"
            onPress={() => goNewRequest('managed')}
          />
          <View style={s.actionDivider} />
          <ActionCard
            step="03"
            title="اصنع فكرتك"
            sub="وكيل معبر يحوّل فكرتك لطلب تصنيع"
            onPress={goIdeaToProduct}
          />
        </View>

        {/* ── 5. Footer ───────────────────────────────────────────── */}
        <View style={s.footer}>
          <View style={s.footerLogoWrap}>
            <MaabarLogo />
          </View>

          <View style={s.footerGrid}>
            <TouchableOpacity style={s.footerCell} activeOpacity={0.7}>
              <Text style={s.footerLinkText}>عن معبر</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.footerCell} onPress={goFAQ} activeOpacity={0.7}>
              <Text style={s.footerLinkText}>الأسئلة الشائعة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.footerCell} onPress={goTerms} activeOpacity={0.7}>
              <Text style={s.footerLinkText}>الشروط والأحكام</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.footerCell} onPress={goContact} activeOpacity={0.7}>
              <Text style={s.footerLinkText}>تواصل معنا</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.footerEmail}>info@maabar.io</Text>
          <Text style={s.footerCopy}>
            معبر © 2026 · جميع الحقوق محفوظة · السجل التجاري 7042243308
          </Text>
        </View>

      </ScrollView>

    </SafeAreaView>
  );
}

/* ── ActionCard ─────────────────────────────────────────────────────────── */
function ActionCard({ step, title, sub, onPress }) {
  return (
    <TouchableOpacity style={s.actionCard} onPress={onPress} activeOpacity={0.78}>
      {/* Arrow on physical left */}
      <Text style={s.actionArrow}>›</Text>

      {/* Text block: right-aligned (RTL) */}
      <View style={s.actionText}>
        <View style={s.actionTitleRow}>
          {/* Title first (physical left), step second (physical right = RTL start) */}
          <Text style={s.actionTitle}>{title}</Text>
          <Text style={s.actionStep}>{step}</Text>
        </View>
        <Text style={s.actionSub}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: C.bgBase,  // cream fills status-bar + home-indicator safe areas
  },

  /* Navbar */
  navbar: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  navCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLogin: {
    fontFamily: F.arSemi,
    fontSize: 13,
    color: C.textPrimary,
  },

  /* Scroll */
  scroll: {
    flex: 1,
    backgroundColor: C.bgBase,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'flex-end',
  },
  heroLabel: {
    fontFamily: F.ar,
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'right',
    marginBottom: 14,
  },
  heroH1: {
    fontFamily: F.arBold,
    fontSize: 26,
    color: C.textPrimary,
    textAlign: 'right',
    lineHeight: 34,
    marginBottom: 14,
  },
  heroSub: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'right',
  },

  /* Browse cards */
  browseRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  browseCard: {
    flex: 1,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  browseTitle: {
    fontFamily: F.arBold,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'center',
  },

  /* Action cards */
  actionBlock: {
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 0,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  actionArrow: {
    fontFamily: F.en,
    fontSize: 22,
    color: DIM,
    lineHeight: 24,
  },
  actionText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  actionStep: {
    fontFamily: F.enSemi,
    fontSize: 16,
    color: 'rgba(0,0,0,0.40)',
  },
  actionTitle: {
    fontFamily: F.arBold,
    fontSize: 16,
    color: C.textPrimary,
  },
  actionSub: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'right',
  },
  actionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },

  /* Footer */
  footer: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerLogoWrap: {
    marginBottom: 28,
  },
  footerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 24,
  },
  footerCell: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerLinkText: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.textSecondary,
  },
  footerEmail: {
    fontFamily: F.en,
    fontSize: 13,
    color: C.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  footerCopy: {
    fontFamily: F.ar,
    fontSize: 11,
    color: DIM,
    textAlign: 'center',
    lineHeight: 18,
  },

});
