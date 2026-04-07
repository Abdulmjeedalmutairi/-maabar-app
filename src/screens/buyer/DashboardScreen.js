import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';
import MaabarLogo from '../../components/MaabarLogo';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STEPS = ['open', 'offers_received', 'closed', 'paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'];

// ─── PendingActionRow ─────────────────────────────────────────────────────────
function PendingActionRow({ action, lang, onPress }) {
  const isAr = lang === 'ar';
  const req   = action.request;
  const rTitle = isAr
    ? (req?.title_ar || req?.title_en || '')
    : lang === 'zh'
      ? (req?.title_zh || req?.title_en || '')
      : (req?.title_en || req?.title_ar || '');

  const title = (() => {
    switch (action.type) {
      case 'offers':            return isAr ? `${action.count} عرض ينتظر مراجعتك — ${rTitle}` : lang === 'zh' ? `${action.count} 条报价等待审核 — ${rTitle}` : `${action.count} offer(s) waiting — ${rTitle}`;
      case 'managed_shortlist': return isAr ? `العروض المختارة لك جاهزة — ${rTitle}`          : lang === 'zh' ? `已为您筛选出报价 — ${rTitle}`                  : `Selected offers ready — ${rTitle}`;
      case 'payment_sent':      return isAr ? 'تم الدفع — في انتظار تجهيز المورد'              : lang === 'zh' ? '已付款 — 等待供应商备货'                          : 'Payment sent — Awaiting preparation';
      case 'ready_to_ship':     return isAr ? 'شحنتك جاهزة — ادفع الدفعة الثانية'              : lang === 'zh' ? '货物已备好 — 支付第二笔款项'                        : 'Shipment ready — Pay second installment';
      case 'delivery':          return isAr ? `تأكيد استلام — ${rTitle}`                       : lang === 'zh' ? `确认收货 — ${rTitle}`                             : `Confirm delivery — ${rTitle}`;
      case 'messages':          return isAr ? `${action.count} رسالة غير مقروءة`               : lang === 'zh' ? `${action.count} 条未读消息`                        : `${action.count} unread message(s)`;
      default: return '';
    }
  })();

  const sub = (() => {
    switch (action.type) {
      case 'offers':            return isAr ? 'قارن العروض واختر الأفضل'       : lang === 'zh' ? '比较并选择最佳报价'           : 'Compare and choose the best';
      case 'managed_shortlist': return isAr ? 'راجع العروض المختارة لك'         : lang === 'zh' ? '查看为您筛选的报价'           : 'Review selected offers';
      case 'payment_sent':      return isAr ? 'المورد يجهز شحنتك'               : lang === 'zh' ? '供应商正在备货'               : 'Supplier is preparing your order';
      case 'ready_to_ship':     return isAr ? 'اضغط للدفع وإتمام الشحن'         : lang === 'zh' ? '点击付款完成发货'             : 'Tap to pay and complete shipping';
      case 'delivery':          return isAr ? 'الطلب وصل — أكد الاستلام'        : lang === 'zh' ? '订单已到达 — 确认收货'         : 'Order arrived — confirm receipt';
      case 'messages':          return isAr ? 'اضغط للاطلاع'                   : lang === 'zh' ? '点击查看'                     : 'Tap to view';
      default: return '';
    }
  })();

  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.75}>
      <View style={{ flex: 1 }}>
        <Text style={[s.actionTitle, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]} numberOfLines={2}>
          {title}
        </Text>
        {!!sub && (
          <Text style={[s.actionSub, { textAlign: isAr ? 'right' : 'left' }]}>{sub}</Text>
        )}
      </View>
      <Text style={s.actionArrow}>{isAr ? '←' : '→'}</Text>
    </TouchableOpacity>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, highlight, onPress }) {
  return (
    <TouchableOpacity
      style={[s.statCard, highlight && s.statCardHL]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={s.statCardLabel}>{label}</Text>
      <Text style={[s.statCardValue, highlight && s.statCardValueHL]}>{value}</Text>
    </TouchableOpacity>
  );
}

// ─── QuickActionCard ──────────────────────────────────────────────────────────
function QuickActionCard({ title, sub, onPress, primary, isAr }) {
  return (
    <TouchableOpacity
      style={[s.quickCard, primary && s.quickCardPrimary]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.quickTitle, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]}>
        {title}
      </Text>
      <Text style={[s.quickSub, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
        {sub}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const lang = getLang();
  const isAr = lang === 'ar';
  const tx   = (ar, en, zh) => lang === 'ar' ? ar : lang === 'zh' ? zh : en;

  const [profile,        setProfile]        = useState(null);
  const [stats,          setStats]          = useState({ requests: 0, offers: 0, messages: 0, productInquiries: 0 });
  const [pendingActions, setPendingActions] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  // ── loadStats ────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async (userId) => {
    const { data: reqIdRows } = await supabase
      .from('requests').select('id').eq('buyer_id', userId);
    const reqIds = reqIdRows?.map(r => r.id) || [];

    const [reqsRes, msgsRes, offersRes, inquiriesRes] = await Promise.all([
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('buyer_id', userId),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).eq('is_read', false),
      reqIds.length > 0
        ? supabase.from('offers').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('request_id', reqIds)
        : Promise.resolve({ count: 0 }),
      supabase.from('product_inquiries').select('id', { count: 'exact', head: true }).eq('buyer_id', userId),
    ]);

    setStats({
      requests:         reqsRes.count      || 0,
      offers:           offersRes.count    || 0,
      messages:         msgsRes.count      || 0,
      productInquiries: inquiriesRes.count || 0,
    });
  }, []);

  // ── loadPendingActions ───────────────────────────────────────────────────────
  const loadPendingActions = useCallback(async (userId) => {
    const [{ data: reqs }, { data: msgs }] = await Promise.all([
      supabase.from('requests').select('*, offers(id,status)').eq('buyer_id', userId),
      supabase.from('messages').select('id').eq('receiver_id', userId).eq('is_read', false),
    ]);

    const actions = [];
    if (reqs) {
      reqs.forEach(r => {
        const pending = r.offers?.filter(o => o.status === 'pending') || [];
        if (String(r.sourcing_mode || 'direct') === 'managed' && String(r.managed_status || '') === 'shortlist_ready') {
          actions.push({ type: 'managed_shortlist', request: r });
        } else if (pending.length > 0) {
          actions.push({ type: 'offers', request: r, count: pending.length });
        }
        if (r.status === 'paid')          actions.push({ type: 'payment_sent',  request: r });
        if (r.status === 'ready_to_ship') actions.push({ type: 'ready_to_ship', request: r });
        if (r.status === 'shipping')      actions.push({ type: 'delivery',      request: r });
      });
    }
    if (msgs?.length > 0) actions.push({ type: 'messages', count: msgs.length });

    setPendingActions(actions);
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────────────
  const loadInitial = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single();
      setProfile(profileData);

      await Promise.all([loadStats(user.id), loadPendingActions(user.id)]);
    } catch (e) {
      console.error('[Dashboard] loadInitial error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadStats, loadPendingActions]);

  useEffect(() => {
    loadInitial();
    const ch = supabase
      .channel('buyer-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { loadStats(user.id); loadPendingActions(user.id); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { loadStats(user.id); loadPendingActions(user.id); }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadInitial, loadStats, loadPendingActions]);

  function onRefresh() { setRefreshing(true); loadInitial(); }

  function handlePendingActionPress(action) {
    if (action.type === 'messages') {
      navigation.navigate('Inbox');
    } else if (action.request) {
      navigation.navigate('Requests', {
        screen: 'Offers',
        params: { requestId: action.request.id, title: action.request.title_ar || action.request.title_en },
      });
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={C.textSecondary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={[s.header, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <MaabarLogo />
        <View style={{ alignItems: isAr ? 'flex-start' : 'flex-end' }}>
          <Text style={s.headerSub}>
            {tx('مَعبر · لوحة التاجر', 'Maabar · Trader Dashboard', 'Maabar · 买家中心')}
          </Text>
          {!!firstName && (
            <Text style={[s.headerName, { fontFamily: isAr ? F.arBold : F.enBold }]}>
              {tx(`أهلاً، ${firstName}`, `Welcome, ${firstName}`, `欢迎，${firstName}`)}
            </Text>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textTertiary} />
        }
      >

        {/* يحتاج انتباهك */}
        {pendingActions.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
              {tx(`يحتاج انتباهك (${pendingActions.length})`, `Needs Attention (${pendingActions.length})`, `需要关注 (${pendingActions.length})`)}
            </Text>
            {pendingActions.map((action, i) => (
              <PendingActionRow
                key={i}
                action={action}
                lang={lang}
                onPress={() => handlePendingActionPress(action)}
              />
            ))}
          </View>
        )}

        {/* Stats — 2×2 grid */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
            {tx('الإحصائيات', 'Overview', '数据概览')}
          </Text>
          <View style={s.statsGrid}>
            <StatCard
              label={tx('طلبات مرفوعة', 'Requests Posted', '已发布需求')}
              value={stats.requests}
              onPress={() => navigation.navigate('Requests', { screen: 'RequestsList' })}
            />
            <StatCard
              label={tx('عروض مستلمة', 'Offers Received', '已收到报价')}
              value={stats.offers}
              highlight={stats.offers > 0}
              onPress={() => {
                const offerAction = pendingActions.find(
                  a => (a.type === 'offers' || a.type === 'managed_shortlist') && a.request
                );
                if (offerAction) {
                  navigation.navigate('Requests', {
                    screen: 'Offers',
                    params: {
                      requestId: offerAction.request.id,
                      title: offerAction.request.title_ar || offerAction.request.title_en,
                    },
                  });
                } else {
                  navigation.navigate('Requests');
                }
              }}
            />
            <StatCard
              label={tx('رسائل جديدة', 'New Messages', '新消息')}
              value={stats.messages}
              highlight={stats.messages > 0}
              onPress={() => navigation.navigate('Inbox')}
            />
            <StatCard
              label={tx('استفسارات', 'Product Inquiries', '产品咨询')}
              value={stats.productInquiries}
              onPress={() => navigation.navigate('Inbox')}
            />
          </View>
        </View>

        {/* Quick actions — 2×2 grid */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
            {tx('الإجراءات السريعة', 'Quick Actions', '快速操作')}
          </Text>
          <View style={s.quickGrid}>
            <QuickActionCard
              primary
              isAr={isAr}
              title={tx('تصفح المنتجات', 'Browse Products', '浏览产品')}
              sub={tx('استكشف منتجات الموردين الصينيين', 'Explore Chinese supplier products', '探索中国供应商产品')}
              onPress={() => navigation.navigate('Products')}
            />
            <QuickActionCard
              isAr={isAr}
              title={tx('رفع طلب جديد', 'Post New Request', '发布新需求')}
              sub={tx('لمنتج واضح وتحتاج عروض مباشرة', 'For a known product and direct offers', '适合已知产品的直接报价')}
              onPress={() => navigation.navigate('NewRequestStack', { mode: 'direct' })}
            />
            <QuickActionCard
              isAr={isAr}
              title={tx('تصفح الموردين', 'Browse Suppliers', '浏览供应商')}
              sub={tx('موردون صينيون مراجعون من مَعبر', 'China-based suppliers reviewed by Maabar', '经Maabar审核的中国供应商')}
              onPress={() => navigation.navigate('Suppliers')}
            />
            <QuickActionCard
              isAr={isAr}
              title={tx('طلباتي', 'My Requests', '我的需求')}
              sub={tx('تابع الطلبات، العروض، والدفع', 'Track requests, offers, and payments', '跟踪需求、报价和付款')}
              onPress={() => navigation.navigate('Requests')}
            />
          </View>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={s.ctaBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('NewRequestStack', { mode: 'direct' })}
        >
          <Text style={[s.ctaBtnText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
            {tx('+ رفع طلب جديد', '+ New Request', '+ 发布新需求')}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },

  // Header
  header: {
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.bgSubtle,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  headerSub:  { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.textDisabled, marginBottom: 4, fontFamily: F.en },
  headerName: { fontSize: 18, color: C.textPrimary },

  // Sections
  section:      { marginBottom: 28 },
  sectionLabel: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.textDisabled, marginBottom: 12 },

  // Stats (2×2 grid)
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.5%', backgroundColor: C.bgSubtle,
    borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  statCardHL:      { backgroundColor: C.bgRaised, borderColor: C.borderMuted },
  statCardLabel:   { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.textDisabled, marginBottom: 14, fontFamily: F.en },
  statCardValue:   { fontSize: 40, color: C.textSecondary, lineHeight: 44, letterSpacing: -1.5, fontFamily: F.en },
  statCardValueHL: { color: C.textPrimary },

  // Quick actions (2×2 grid)
  quickGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard:        { width: '47.5%', backgroundColor: C.bgSubtle, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.borderSubtle },
  quickCardPrimary: { backgroundColor: C.bgRaised, borderColor: C.borderMuted },
  quickTitle:       { fontSize: 13, color: C.textPrimary, marginBottom: 6 },
  quickSub:         { fontSize: 11, color: C.textTertiary, lineHeight: 17 },

  // Pending actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bgSubtle, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 14, marginBottom: 8, gap: 10,
  },
  actionTitle: { fontSize: 13, color: C.textPrimary, marginBottom: 3, lineHeight: 19 },
  actionSub:   { fontSize: 11, color: C.textDisabled, letterSpacing: 0.5 },
  actionArrow: { color: C.textDisabled, fontSize: 14, flexShrink: 0 },

  // Primary CTA button
  ctaBtn:     { backgroundColor: C.btnPrimary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaBtnText: { fontSize: 15, color: C.btnPrimaryText },
});
