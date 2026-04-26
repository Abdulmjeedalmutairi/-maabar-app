import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const STATUS_AR = { open: 'مرفوع', offers_received: 'عروض وصلت', closed: 'عرض مقبول', supplier_confirmed: 'المورد جاهز', paid: 'تم الدفع', ready_to_ship: 'الشحنة جاهزة', shipping: 'قيد الشحن', arrived: 'وصل السعودية', delivered: 'تم التسليم' };
const STATUS_EN = { open: 'Posted', offers_received: 'Offers In', closed: 'Accepted', supplier_confirmed: 'Supplier Ready', paid: 'Paid', ready_to_ship: 'Ready to Ship', shipping: 'Shipping', arrived: 'Arrived', delivered: 'Delivered' };

const TIMELINE_STEPS = [
  { key: 'posted',    ar: 'رفع الطلب',     en: 'Posted'   },
  { key: 'accepted',  ar: 'قبول العرض',    en: 'Accepted' },
  { key: 'paid',      ar: 'الدفعة الأولى', en: '1st Pay'  },
  { key: 'producing', ar: 'الإنتاج',       en: 'Production'},
  { key: 'shipping',  ar: 'الشحن',         en: 'Shipping' },
  { key: 'received',  ar: 'الاستلام',      en: 'Received' },
];

function timelineIndex(status) {
  const map = { open: 0, offers_received: 0, closed: 1, paid: 2, supplier_confirmed: 3, ready_to_ship: 3, shipping: 4, arrived: 4, delivered: 5 };
  return map[status] ?? 0;
}

function MiniTimeline({ status, isArabic }) {
  const current = timelineIndex(status);
  return (
    <View style={{ flexDirection: isArabic ? 'row-reverse' : 'row', alignItems: 'center', marginTop: 8 }}>
      {TIMELINE_STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        const isLast = i === TIMELINE_STEPS.length - 1;
        return (
          <React.Fragment key={step.key}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: done ? '#5a9a72' : active ? C.textPrimary : C.bgRaised, borderWidth: 1.5, borderColor: done ? '#5a9a72' : active ? C.textPrimary : C.borderDefault }} />
            {!isLast && <View style={{ flex: 1, height: 1, backgroundColor: i < current ? '#5a9a72' : C.borderSubtle }} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function PaymentBadge({ label, amount, currency, badgeState }) {
  const colors = {
    paid:    { bg: 'rgba(90,154,114,0.07)', border: 'rgba(90,154,114,0.3)',  text: '#5a9a72' },
    due:     { bg: 'rgba(180,120,30,0.07)', border: 'rgba(180,120,30,0.3)',  text: '#b4781e' },
    pending: { bg: C.bgOverlay,             border: C.borderSubtle,           text: C.textDisabled },
  };
  const c = colors[badgeState] || colors.pending;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 8, color: c.text, fontFamily: F.arSemi, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: c.text, fontFamily: F.num }}>{amount > 0 ? Number(amount).toFixed(0) : '—'}<Text style={{ fontSize: 8, color: C.textDisabled }}> {currency}</Text></Text>
    </View>
  );
}

function MiniPaymentRow({ request, offer }) {
  if (!offer) return null;
  const showFrom = ['closed','supplier_confirmed','paid','ready_to_ship','shipping','arrived','delivered'];
  if (!showFrom.includes(request.status)) return null;
  const subtotal  = (offer.price || 0) * (Number(request.quantity) || 1);
  const shipping  = parseFloat(offer.shipping_cost) || 0;
  const total     = subtotal + shipping;
  const pct       = request.payment_pct > 0 ? request.payment_pct : 30;
  const firstAmt  = request.amount > 0 ? request.amount : parseFloat((total * pct / 100).toFixed(2));
  const secondAmt = request.payment_second > 0 ? request.payment_second : parseFloat((total * (100 - pct) / 100).toFixed(2));
  const currency  = offer.currency || 'USD';
  const isPaidFirst  = ['paid','ready_to_ship','shipping','arrived','delivered'].includes(request.status);
  const isPaidSecond = ['shipping','arrived','delivered'].includes(request.status) || !!request.payment_second_paid;
  const isDueSecond  = request.status === 'ready_to_ship';
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
      <PaymentBadge label={`دفعة أولى · ${pct}%`}        amount={firstAmt}  currency={currency} badgeState={isPaidFirst ? 'paid' : 'pending'} />
      <PaymentBadge label={`دفعة ثانية · ${100 - pct}%`} amount={secondAmt} currency={currency} badgeState={isPaidSecond ? 'paid' : isDueSecond ? 'due' : 'pending'} />
    </View>
  );
}

/* ── Pending Banner (all 8 types) ── */
function PendingBanner({ action, isAr, navigation }) {
  const styles = {
    supplier_confirmed: { border: 'rgba(90,154,114,0.35)',  bg: 'rgba(90,154,114,0.05)',  dot: '#5a9a72' },
    ready_to_ship:      { border: 'rgba(180,120,30,0.35)',  bg: 'rgba(180,120,30,0.05)',  dot: '#b4781e' },
    arrived:            { border: 'rgba(60,100,180,0.35)',  bg: 'rgba(60,100,180,0.04)',  dot: '#4a6bbf' },
    offers:             { border: C.borderSubtle,           bg: C.bgSubtle,               dot: C.textDisabled },
    managed_shortlist:  { border: C.borderSubtle,           bg: C.bgSubtle,               dot: C.textDisabled },
    messages:           { border: C.borderSubtle,           bg: C.bgSubtle,               dot: C.textDisabled },
    payment_sent:       { border: C.borderSubtle,           bg: C.bgSubtle,               dot: C.textDisabled },
    delivery:           { border: 'rgba(60,100,180,0.35)',  bg: 'rgba(60,100,180,0.04)',  dot: '#4a6bbf' },
  };
  const st = styles[action.type] || styles.offers;
  const title = (() => {
    const rTitle = action.request ? (isAr ? (action.request.title_ar || action.request.title_en) : (action.request.title_en || action.request.title_ar)) : '';
    if (action.type === 'supplier_confirmed') return isAr ? `المورد جاهز — ادفع الآن · ${rTitle}` : `Supplier ready — pay now · ${rTitle}`;
    if (action.type === 'ready_to_ship')      return isAr ? `الشحنة جاهزة — ادفع الدفعة الثانية · ${rTitle}` : `Shipment ready — pay 2nd installment · ${rTitle}`;
    if (action.type === 'arrived')            return isAr ? `وصل الطلب — أكد الاستلام · ${rTitle}` : `Order arrived — confirm delivery · ${rTitle}`;
    if (action.type === 'offers')             return isAr ? `${action.count} عرض ينتظرك — ${rTitle}` : `${action.count} offer(s) waiting — ${rTitle}`;
    if (action.type === 'managed_shortlist')  return isAr ? `العروض المختارة جاهزة — ${rTitle}` : `Selected offers ready — ${rTitle}`;
    if (action.type === 'payment_sent')       return isAr ? `تم الدفع — في انتظار تجهيز المورد · ${rTitle}` : `Payment sent — Awaiting preparation · ${rTitle}`;
    if (action.type === 'delivery')           return isAr ? `أكد الاستلام — ${rTitle}` : `Confirm delivery — ${rTitle}`;
    if (action.type === 'messages')           return isAr ? `${action.count} رسالة غير مقروءة` : `${action.count} unread message(s)`;
    return '';
  })();

  function onGo() {
    if (action.type === 'messages') { navigation.navigate('Inbox'); return; }
    const requestId = action.request?.id;
    const postAcceptance = ['supplier_confirmed', 'paid', 'ready_to_ship', 'delivery', 'arrived'];
    if (requestId && postAcceptance.includes(action.type)) {
      navigation.navigate('OrderDetail', { requestId });
      return;
    }
    if (requestId && action.type === 'managed_shortlist') {
      const title = action.request?.title_ar || action.request?.title_en;
      navigation.navigate('Requests', { screen: 'ManagedRequest', params: { requestId, title } });
      return;
    }
    if (requestId && action.type === 'offers') {
      const title = action.request?.title_ar || action.request?.title_en;
      navigation.navigate('Requests', { screen: 'Offers', params: { requestId, title } });
      return;
    }
    navigation.navigate('Requests', requestId ? { requestId } : undefined);
  }

  return (
    <TouchableOpacity
      onPress={onGo}
      activeOpacity={0.8}
      style={{ backgroundColor: st.bg, borderWidth: 1, borderColor: st.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Text style={{ color: C.textDisabled, fontSize: 14 }}>{isAr ? '←' : '→'}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 13, color: C.textPrimary, fontFamily: F.ar, textAlign: 'right', flex: 1, lineHeight: 18 }}>{title}</Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.dot }} />
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardOverview({
  profile,
  stats,
  requests,
  pendingActions,
  activeOrders,
  activeOrdersLoading,
  loading,
  refreshing,
  onRefresh,
  isArabic = true,
  navigation,
}) {
  const isAr = isArabic;

  if (loading && !refreshing) {
    return (
      <View style={s.loadingContainer}>
        <Text style={s.loadingText}>{isAr ? 'جاري التحميل...' : 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textTertiary} />}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Stats strip (4 cells) ── */}
      <View style={s.statsStrip}>
        {[
          { label: isAr ? 'يحتاج إجراء' : 'Needs Action', value: stats.needsAction || 0, red: (stats.needsAction || 0) > 0, onPress: () => navigation.navigate('Requests') },
          { label: isAr ? 'طلبات' : 'Active',              value: stats.requests  || 0, onPress: () => navigation.navigate('Requests') },
          { label: isAr ? 'عروض' : 'Offers',               value: stats.offers    || 0, green: (stats.offers || 0) > 0, onPress: () => navigation.navigate('Requests', { screen: 'AllOffers' }) },
          { label: isAr ? 'رسائل جديدة' : 'Messages',     value: stats.messages  || 0, onPress: () => navigation.navigate('Inbox') },
        ].map((st, i) => (
          <TouchableOpacity key={i} style={[s.statCell, i < 3 && s.statCellBorder]} onPress={st.onPress} activeOpacity={0.75}>
            <Text style={s.statLabel}>{st.label}</Text>
            <Text style={[s.statValue, st.red && { color: C.red }, st.green && { color: '#5a9a72' }]}>{st.value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Pending action banners ── */}
      {pendingActions && pendingActions.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {isAr ? `يحتاج انتباهك (${pendingActions.length})` : `Needs Attention (${pendingActions.length})`}
          </Text>
          <View style={{ gap: 8 }}>
            {pendingActions.map((action, i) => (
              <PendingBanner key={i} action={action} isAr={isAr} navigation={navigation} />
            ))}
          </View>
        </View>
      )}

      {/* ── Active orders ── */}
      {(activeOrdersLoading || (activeOrders && activeOrders.length > 0)) && (
        <View style={s.section}>
          <View style={s.sectionRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Requests')} activeOpacity={0.75}>
              <Text style={s.sectionLink}>{isAr ? 'عرض الكل' : 'View all'}</Text>
            </TouchableOpacity>
            <Text style={s.sectionTitle}>{isAr ? 'طلبات نشطة' : 'Active Orders'}</Text>
          </View>
          {activeOrdersLoading && (
            <View style={{ height: 60, backgroundColor: C.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: C.borderSubtle }} />
          )}
          {!activeOrdersLoading && (activeOrders || []).map(r => {
            const acceptedOffer = (r.offers || []).find(o => o.status === 'accepted');
            const supplierName  = acceptedOffer?.profiles?.company_name || acceptedOffer?.profiles?.full_name || null;
            const statusLabel   = isAr ? (STATUS_AR[r.status] || r.status) : (STATUS_EN[r.status] || r.status);
            const rTitle        = isAr ? (r.title_ar || r.title_en) : (r.title_en || r.title_ar);
            return (
              <TouchableOpacity
                key={r.id}
                style={s.activeOrderCard}
                onPress={() => navigation.navigate('OrderDetail', { requestId: r.id })}
                activeOpacity={0.8}
              >
                <View style={s.activeOrderHeader}>
                  <View style={s.statusPill}>
                    <Text style={s.statusPillText}>{statusLabel}</Text>
                  </View>
                  <Text style={s.activeOrderTitle} numberOfLines={1}>{rTitle}</Text>
                </View>
                {supplierName && <Text style={s.activeOrderSupplier}>{supplierName}</Text>}
                <MiniTimeline status={r.status} isArabic={isAr} />
                <MiniPaymentRow request={r} offer={acceptedOffer} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Quick actions ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</Text>
        <View style={s.quickGrid}>
          {[
            { label: isAr ? 'رفع طلب جديد' : 'Post New Request', sub: isAr ? 'ارفع طلبك للموردين' : 'Post your RFQ to suppliers', primary: true,  screen: 'NewRequestStack', params: { mode: 'direct' } },
            { label: isAr ? 'تصفح المنتجات' : 'Browse Products',  sub: isAr ? 'استعرض الكتالوج'   : 'Browse available catalog',  primary: false, screen: 'Products'   },
            { label: isAr ? 'طلباتي' : 'My Requests',             sub: isAr ? 'جميع طلباتك'       : 'View all your requests',    primary: false, screen: 'Requests'   },
            { label: isAr ? 'العينات' : 'Samples',                sub: isAr ? 'طلبات العينات'      : 'Your sample requests',     primary: false, screen: 'Samples'    },
          ].map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[s.quickCard, a.primary && s.quickCardPrimary]}
              onPress={() => navigation.navigate(a.screen, a.params)}
              activeOpacity={0.8}
            >
              <Text style={s.quickLabel}>{a.label}</Text>
              <Text style={s.quickSub}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Recent requests ── */}
      {requests && requests.length > 0 && (
        <View style={[s.section, { paddingBottom: 40 }]}>
          <Text style={s.sectionTitle}>{isAr ? 'طلباتي الأخيرة' : 'Recent Requests'}</Text>
          {requests.slice(0, 3).map(r => {
            const st     = isAr ? (STATUS_AR[r.status] || r.status) : (STATUS_EN[r.status] || r.status);
            const rTitle = isAr ? (r.title_ar || r.title_en) : (r.title_en || r.title_ar);
            return (
              <TouchableOpacity key={r.id} style={s.recentCard} onPress={() => navigation.navigate('OrderDetail', { requestId: r.id })} activeOpacity={0.8}>
                <Text style={s.recentStatus}>{st}</Text>
                <Text style={s.recentTitle} numberOfLines={1}>{rTitle}</Text>
              </TouchableOpacity>
            );
          })}
          {requests.length > 3 && (
            <TouchableOpacity style={s.viewAll} onPress={() => navigation.navigate('Requests')}>
              <Text style={s.viewAllText}>{isAr ? 'عرض الكل →' : 'View All →'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bgBase },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:      { color: C.textTertiary, fontSize: 14, fontFamily: F.ar },

  /* Stats strip */
  statsStrip:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  statCell:       { flex: 1, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  statCellBorder: { borderRightWidth: 1, borderRightColor: C.borderSubtle },
  statLabel:      { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: C.textDisabled, marginBottom: 8, fontFamily: F.en, fontWeight: '500' },
  statValue:      { fontSize: 32, fontWeight: '300', color: C.textPrimary, lineHeight: 44, fontFamily: F.ar },

  /* Section */
  section:    { paddingHorizontal: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  sectionTitle: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.textDisabled, marginBottom: 12, fontWeight: '500', fontFamily: F.en },
  sectionLink:  { fontSize: 11, color: C.textSecondary, fontFamily: F.ar },

  /* Active order card */
  activeOrderCard: { backgroundColor: C.bgRaised, borderRadius: 14, borderWidth: 1, borderColor: C.borderDefault, padding: 14, marginBottom: 10 },
  activeOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  activeOrderTitle: { flex: 1, fontSize: 14, color: C.textPrimary, fontFamily: F.arSemi, textAlign: 'right', lineHeight: 20 },
  activeOrderSupplier: { fontSize: 11, color: C.textDisabled, marginBottom: 4, textAlign: 'right', fontFamily: F.ar },
  statusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: C.borderSubtle, flexShrink: 0 },
  statusPillText: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: C.textDisabled, fontFamily: F.en },

  /* Quick actions */
  quickGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard:        { width: '47%', backgroundColor: C.bgSubtle, borderRadius: 14, borderWidth: 1, borderColor: C.borderSubtle, padding: 16 },
  quickCardPrimary: { backgroundColor: C.bgRaised, borderColor: C.borderMuted },
  quickLabel: { fontSize: 14, fontWeight: '500', color: C.textPrimary, marginBottom: 6, fontFamily: F.ar, textAlign: 'right' },
  quickSub:   { fontSize: 11, color: C.textTertiary, fontFamily: F.ar, lineHeight: 16, textAlign: 'right' },

  /* Recent requests */
  recentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderSubtle, gap: 10 },
  recentTitle:  { flex: 1, fontSize: 14, color: C.textPrimary, fontFamily: F.arSemi, textAlign: 'right' },
  recentStatus: { fontSize: 10, color: C.textDisabled, fontFamily: F.en, letterSpacing: 1 },
  viewAll:     { marginTop: 14, alignItems: 'center' },
  viewAllText: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar },
});
