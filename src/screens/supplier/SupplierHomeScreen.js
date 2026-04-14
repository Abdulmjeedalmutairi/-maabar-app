import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

function parseDesc(raw, lang) {
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      return obj[lang] || obj.ar || obj.en || obj.zh || '';
    }
  } catch {}
  return String(raw);
}

const COPY = {
  ar: {
    welcome: 'أهلاً،', desc: 'تابع عروضك ومنتجاتك ورسائلك',
    activeProducts: 'منتجات نشطة', allOffers: 'عروض مقدمة',
    unreadMsgs: 'رسائل جديدة', acceptedOffers: 'عروض مقبولة',
    myOffers: 'عروضي', noOffers: 'لم تقدم عروضاً بعد',
    viewRequests: 'تصفح الطلبات', inquiries: 'استفسارات المنتجات',
    noInquiries: 'لا توجد استفسارات', samples: 'طلبات العينات',
    noSamples: 'لا توجد طلبات عينات', viewAll: 'عرض الكل ←',
    offerStatus: { pending: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض' },
    sampleStatus: { pending: 'قيد المراجعة', approved: 'مقبول', shipped: 'تم الشحن', rejected: 'مرفوض' },
    verifyLabels: {
      registered: 'مسجّل', verification_required: 'التحقق مطلوب',
      verification_under_review: 'قيد المراجعة', verified: 'موثّق',
      rejected: 'مرفوض', inactive: 'غير نشط',
    },
    close: 'إغلاق', inquiry: 'تفاصيل الاستفسار', question: 'السؤال',
    product: 'المنتج', date: 'التاريخ',
    dismiss: 'إخفاء', confirmDismiss: 'إخفاء هذا العرض المرفوض؟',
    cancelBtn: 'إلغاء', confirm: 'تأكيد',
  },
  en: {
    welcome: 'Welcome,', desc: 'Manage your offers, products and messages',
    activeProducts: 'Active Products', allOffers: 'Offers Sent',
    unreadMsgs: 'New Messages', acceptedOffers: 'Accepted Offers',
    myOffers: 'My Offers', noOffers: 'No offers submitted yet',
    viewRequests: 'Browse Requests', inquiries: 'Product Inquiries',
    noInquiries: 'No inquiries yet', samples: 'Sample Requests',
    noSamples: 'No sample requests yet', viewAll: 'View all →',
    offerStatus: { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' },
    sampleStatus: { pending: 'Pending', approved: 'Approved', shipped: 'Shipped', rejected: 'Rejected' },
    verifyLabels: {
      registered: 'Registered', verification_required: 'Verification Required',
      verification_under_review: 'Under Review', verified: 'Verified',
      rejected: 'Rejected', inactive: 'Inactive',
    },
    close: 'Close', inquiry: 'Inquiry Details', question: 'Question',
    product: 'Product', date: 'Date',
    dismiss: 'Dismiss', confirmDismiss: 'Dismiss this rejected offer?',
    cancelBtn: 'Cancel', confirm: 'Confirm',
  },
  zh: {
    welcome: '欢迎，', desc: '管理您的报价、产品和消息',
    activeProducts: '在售产品', allOffers: '已发报价',
    unreadMsgs: '新消息', acceptedOffers: '已接受报价',
    myOffers: '我的报价', noOffers: '尚未提交报价',
    viewRequests: '浏览询盘', inquiries: '产品咨询',
    noInquiries: '暂无咨询', samples: '样品申请',
    noSamples: '暂无样品申请', viewAll: '查看全部 →',
    offerStatus: { pending: '待审核', accepted: '已接受', rejected: '已拒绝' },
    sampleStatus: { pending: '待审核', approved: '已批准', shipped: '已发货', rejected: '已拒绝' },
    verifyLabels: {
      registered: '已注册', verification_required: '需要认证',
      verification_under_review: '审核中', verified: '已认证',
      rejected: '已拒绝', inactive: '未激活',
    },
    close: '关闭', inquiry: '咨询详情', question: '问题',
    product: '产品', date: '日期',
    dismiss: '忽略', confirmDismiss: '忽略此被拒绝的报价？',
    cancelBtn: '取消', confirm: '确认',
  },
};

const VERIFY_COLOR = {
  registered: C.blue, verification_required: C.orange,
  verification_under_review: C.orange, verified: C.green,
  rejected: C.red, inactive: C.textDisabled,
};

export default function SupplierHomeScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ products: 0, offers: 0, messages: 0, accepted: 0 });
  const [myOffers, setMyOffers] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 4 stats — exact web queries
    const [profileRes, productsRes, offersRes, messagesRes, acceptedRes] = await Promise.all([
      supabase.from('profiles')
        .select('company_name, status, maabar_supplier_id, country, city')
        .eq('id', user.id).single(),
      supabase.from('products')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', user.id).eq('is_active', true),
      supabase.from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', user.id),
      supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id).eq('is_read', false),
      supabase.from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', user.id).eq('status', 'accepted'),
    ]);

    console.log('[SupplierHome] profile:', profileRes.data);
    console.log('[SupplierHome] stats — products:', productsRes.count, 'offers:', offersRes.count, 'messages:', messagesRes.count, 'accepted:', acceptedRes.count);

    setProfile(profileRes.data);
    setStats({
      products: productsRes.count || 0,
      offers: offersRes.count || 0,
      messages: messagesRes.count || 0,
      accepted: acceptedRes.count || 0,
    });

    // My Offers — exact web query
    const { data: offersData } = await supabase
      .from('offers')
      .select('*,requests(title_ar,title_en,title_zh,buyer_id,status,tracking_number,shipping_status,quantity,description,payment_plan)')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });
    console.log('[SupplierHome] myOffers:', offersData?.length);
    setMyOffers(offersData || []);

    // Product inquiries — direct query (lib not available in mobile)
    const { data: inqData } = await supabase
      .from('product_inquiries')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });
    console.log('[SupplierHome] inquiries:', inqData?.length);
    setInquiries(inqData || []);

    // Sample requests — exact web query
    const { data: sampData } = await supabase
      .from('samples')
      .select('*,products(name_ar,name_en,name_zh)')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });
    console.log('[SupplierHome] samples:', sampData?.length);
    setSamples(sampData || []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  const offerTitle = (o) => {
    const r = o.requests;
    if (!r) return '—';
    if (lang === 'ar') return r.title_ar || r.title_en || r.title_zh || '—';
    if (lang === 'zh') return r.title_zh || r.title_en || r.title_ar || '—';
    return r.title_en || r.title_ar || r.title_zh || '—';
  };

  const sampleProductName = (smp) => {
    const p = smp.products;
    if (!p) return '—';
    if (lang === 'ar') return p.name_ar || p.name_en || p.name_zh || '—';
    if (lang === 'zh') return p.name_zh || p.name_en || p.name_ar || '—';
    return p.name_en || p.name_ar || p.name_zh || '—';
  };

  const offerBadge = (status) => {
    if (status === 'accepted') return { bg: C.greenSoft, border: C.green + '40', color: C.green };
    if (status === 'rejected') return { bg: C.redSoft, border: C.red + '40', color: C.red };
    return { bg: C.orangeSoft, border: C.orange + '40', color: C.orange };
  };

  function dismissOffer(offerId) {
    Alert.alert('', t.confirmDismiss, [
      { text: t.cancelBtn, style: 'cancel' },
      {
        text: t.confirm, style: 'destructive',
        onPress: async () => {
          await supabase.from('offers').delete().eq('id', offerId);
          load();
        },
      },
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
  const isVerified = status === 'verified';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
      >
        <View style={s.content}>

          {/* Welcome banner — neutral dark, no green/purple */}
          <View style={s.banner}>
            <Text style={[s.bannerWelcome, isAr && s.rtl]}>{t.welcome}</Text>
            <Text style={[s.bannerCompany, isAr && s.rtl]} numberOfLines={1}>
              {profile?.company_name || '—'}
            </Text>
            <Text style={[s.bannerDesc, isAr && s.rtl]}>{t.desc}</Text>
            {profile?.maabar_supplier_id ? (
              <Text style={s.supplierId}>{profile.maabar_supplier_id}</Text>
            ) : null}
          </View>

          {/* Verification banner */}
          {!isVerified && (
            <TouchableOpacity
              style={[s.verifyBanner, { borderColor: statusColor + '40' }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SAccount')}
            >
              <View style={[s.verifyDot, { backgroundColor: statusColor }]} />
              <Text style={[s.verifyLabel, { color: statusColor }]}>{statusLabel}</Text>
              <Text style={s.verifyArrow}>{isAr ? '←' : '→'}</Text>
            </TouchableOpacity>
          )}

          {/* 4-stat row */}
          <View style={s.statsRow}>
            <StatCard value={stats.products} label={t.activeProducts} />
            <StatCard value={stats.offers} label={t.allOffers} />
            <StatCard value={stats.messages} label={t.unreadMsgs} color={stats.messages > 0 ? C.orange : undefined} />
            <StatCard value={stats.accepted} label={t.acceptedOffers} color={stats.accepted > 0 ? C.green : undefined} />
          </View>

          {/* My Offers */}
          <SectionHead title={t.myOffers} cta={t.viewAll} isAr={isAr} onPress={() => navigation.navigate('SOffers')} />
          {myOffers.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={[s.emptyText, isAr && s.rtl]}>{t.noOffers}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('SRequests')}>
                <Text style={s.emptyBtnText}>{t.viewRequests}</Text>
              </TouchableOpacity>
            </View>
          ) : myOffers.slice(0, 5).map(o => {
            const bd = offerBadge(o.status);
            return (
              <View key={o.id} style={s.offerCard}>
                <View style={[s.offerRow, isAr && s.rowRtl]}>
                  <View style={[s.badge, { backgroundColor: bd.bg, borderColor: bd.border }]}>
                    <Text style={[s.badgeText, { color: bd.color }]}>
                      {t.offerStatus[o.status] || o.status}
                    </Text>
                  </View>
                  <Text style={[s.offerTitle, isAr && s.rtl]} numberOfLines={2}>
                    {offerTitle(o)}
                  </Text>
                </View>
                {!!o.price && (
                  <Text style={[s.offerMeta, isAr && s.rtl]}>{o.price} USD</Text>
                )}
                {o.status === 'rejected' && (
                  <TouchableOpacity
                    style={s.dismissBtn}
                    onPress={() => dismissOffer(o.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.dismissText}>{t.dismiss}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Product Inquiries */}
          <SectionHead title={t.inquiries} isAr={isAr} />
          {inquiries.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={[s.emptyText, isAr && s.rtl]}>{t.noInquiries}</Text>
            </View>
          ) : inquiries.slice(0, 3).map(inq => (
            <TouchableOpacity
              key={inq.id}
              style={s.inqCard}
              onPress={() => setSelectedInquiry(inq)}
              activeOpacity={0.75}
            >
              <Text style={[s.inqText, isAr && s.rtl]} numberOfLines={2}>
                {inq.question_text || inq.message || '—'}
              </Text>
              <Text style={s.inqDate}>
                {inq.created_at ? new Date(inq.created_at).toLocaleDateString() : ''}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Sample Requests */}
          <SectionHead title={t.samples} isAr={isAr} />
          {samples.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={[s.emptyText, isAr && s.rtl]}>{t.noSamples}</Text>
            </View>
          ) : samples.slice(0, 3).map(smp => {
            const bd = offerBadge(smp.status);
            return (
              <View key={smp.id} style={s.offerCard}>
                <View style={[s.offerRow, isAr && s.rowRtl]}>
                  <View style={[s.badge, { backgroundColor: bd.bg, borderColor: bd.border }]}>
                    <Text style={[s.badgeText, { color: bd.color }]}>
                      {t.sampleStatus[smp.status] || smp.status || '—'}
                    </Text>
                  </View>
                  <Text style={[s.offerTitle, isAr && s.rtl]} numberOfLines={1}>
                    {sampleProductName(smp)}
                  </Text>
                </View>
                {!!smp.quantity && (
                  <Text style={[s.offerMeta, isAr && s.rtl]}>
                    {lang === 'ar' ? `الكمية: ${smp.quantity}` : lang === 'zh' ? `数量: ${smp.quantity}` : `Qty: ${smp.quantity}`}
                  </Text>
                )}
              </View>
            );
          })}

        </View>
      </ScrollView>
      {/* ── Inquiry Detail Modal ── */}
      <Modal visible={!!selectedInquiry} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedInquiry(null)}>
        <SafeAreaView style={s.safe}>
          <View style={[s.modalHeader, isAr && s.rowRtl]}>
            <TouchableOpacity onPress={() => setSelectedInquiry(null)}>
              <Text style={s.modalClose}>{t.close}</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, isAr && s.rtl]}>{t.inquiry}</Text>
          </View>
          <ScrollView contentContainerStyle={s.modalBody}>
            {selectedInquiry && (
              <>
                <View style={s.inqDetailRow}>
                  <Text style={[s.inqDetailLabel, isAr && s.rtl]}>{t.question}</Text>
                  <Text style={[s.inqDetailValue, isAr && s.rtl]}>
                    {selectedInquiry.question_text || selectedInquiry.message || '—'}
                  </Text>
                </View>
                {!!selectedInquiry.product_id && (
                  <View style={s.inqDetailRow}>
                    <Text style={[s.inqDetailLabel, isAr && s.rtl]}>{t.product}</Text>
                    <Text style={[s.inqDetailValue, isAr && s.rtl]}>
                      {selectedInquiry.product_name || selectedInquiry.product_id}
                    </Text>
                  </View>
                )}
                <View style={s.inqDetailRow}>
                  <Text style={[s.inqDetailLabel, isAr && s.rtl]}>{t.date}</Text>
                  <Text style={[s.inqDetailValue, isAr && s.rtl]}>
                    {selectedInquiry.created_at ? new Date(selectedInquiry.created_at).toLocaleDateString() : '—'}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ value, label, color }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, color && { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHead({ title, cta, isAr, onPress }) {
  return (
    <View style={[s.sectionHeader, isAr && s.rowRtl]}>
      <Text style={[s.sectionTitle, isAr && s.rtl]}>{title}</Text>
      {cta && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={s.seeAll}>{cta}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  // Banner — neutral dark, no green/purple
  banner: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borderDefault,
    marginBottom: 16,
  },
  bannerWelcome: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 2 },
  bannerCompany: { color: C.textPrimary, fontSize: 20, fontFamily: F.arSemi, marginBottom: 4 },
  bannerDesc: { color: C.textTertiary, fontSize: 12, fontFamily: F.ar },
  supplierId: { color: C.textDisabled, fontSize: 10, fontFamily: F.en, marginTop: 6 },

  verifyBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 12, borderWidth: 1, marginBottom: 18, gap: 10,
  },
  verifyDot: { width: 8, height: 8, borderRadius: 4 },
  verifyLabel: { flex: 1, fontSize: 13, fontFamily: F.arSemi },
  verifyArrow: { color: C.textDisabled, fontSize: 16 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: C.bgRaised, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 4,
    borderWidth: 1, borderColor: C.borderDefault, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontFamily: F.enBold, color: C.textPrimary, lineHeight: 28 },
  statLabel: { fontSize: 9, fontFamily: F.ar, color: C.textSecondary, textAlign: 'center', marginTop: 4 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10, marginTop: 8,
  },
  sectionTitle: { fontSize: 14, fontFamily: F.arSemi, color: C.textSecondary },
  seeAll: { fontSize: 12, fontFamily: F.ar, color: C.textSecondary },

  offerCard: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  offerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  badge: {
    borderRadius: 20, paddingHorizontal: 8,
    paddingVertical: 3, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontFamily: F.arSemi },
  offerTitle: { flex: 1, color: C.textPrimary, fontSize: 13, fontFamily: F.ar },
  offerMeta: { color: C.textSecondary, fontSize: 12, fontFamily: F.en, marginTop: 6 },

  inqCard: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  inqText: { color: C.textPrimary, fontSize: 13, fontFamily: F.ar, lineHeight: 20 },
  inqDate: { color: C.textDisabled, fontSize: 11, fontFamily: F.en, marginTop: 4 },

  dismissBtn: {
    marginTop: 8, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.red + '40', backgroundColor: C.redSoft,
  },
  dismissText: { color: C.red, fontSize: 11, fontFamily: F.arSemi },

  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  modalTitle: { color: C.textPrimary, fontSize: 17, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },
  modalBody: { padding: 20 },
  inqDetailRow: {
    marginBottom: 16, backgroundColor: C.bgRaised,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  inqDetailLabel: { color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi, marginBottom: 6, letterSpacing: 0.5 },
  inqDetailValue: { color: C.textPrimary, fontSize: 14, fontFamily: F.ar, lineHeight: 22 },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault, marginBottom: 8,
  },
  emptyText: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, marginBottom: 12 },
  emptyBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  emptyBtnText: { color: C.bgBase, fontSize: 13, fontFamily: F.arSemi },
});
