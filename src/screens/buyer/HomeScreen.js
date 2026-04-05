import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import MaabarLogo from '../../components/MaabarLogo';

const STATUS_AR = {
  open: 'مرفوع',
  offers_received: 'عروض وصلت',
  closed: 'عرض مقبول',
  paid: 'تم الدفع',
  ready_to_ship: 'الشحنة جاهزة',
  shipping: 'قيد الشحن',
  arrived: 'وصل السعودية',
  delivered: 'تم التسليم',
};

const STATUS_COLOR = {
  open: C.blue,
  offers_received: C.green,
  closed: C.accent,
  paid: C.green,
  ready_to_ship: C.orange,
  shipping: C.orange,
  arrived: C.green,
  delivered: C.green,
};

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ requests: 0, offers: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, requestsRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, city').eq('id', user.id).single(),
      supabase.from('requests').select('id, title_ar, title_en, quantity, status, created_at')
        .eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id).eq('is_read', false),
    ]);

    setProfile(profileRes.data);

    const reqs = requestsRes.data || [];
    setRequests(reqs);

    const offerCount = await countOffers(reqs.map(r => r.id));

    setStats({
      requests: reqs.filter(r => ['open', 'offers_received'].includes(r.status)).length,
      offers: offerCount,
      messages: messagesRes.count || 0,
    });

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function countOffers(requestIds) {
    if (!requestIds.length) return 0;
    const { count } = await supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .in('request_id', requestIds)
      .eq('status', 'pending');
    return count || 0;
  }

  function onRefresh() { setRefreshing(true); load(); }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        <View style={s.content}>

          {/* Header */}
          <View style={s.header}>
            <MaabarLogo />
            <View style={s.headerRight}>
              <Text style={s.greeting}>أهلاً، {firstName} 👋</Text>
              <Text style={s.subGreeting}>لوحة التاجر</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <StatCard value={stats.requests} label="طلبات نشطة" />
            <StatCard value={stats.offers} label="عروض وصلت" color={C.green} />
            <StatCard value={stats.messages} label="رسائل جديدة" color={C.orange} />
          </View>

          {/* Quick actions */}
          <TouchableOpacity
            style={s.ctaBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Requests', { screen: 'RequestsList', params: { openNew: true } })}
          >
            <View style={s.ctaIcon}>
              <Text style={s.ctaPlus}>+</Text>
            </View>
            <View style={s.ctaText}>
              <Text style={s.ctaTitle}>رفع طلب جديد</Text>
              <Text style={s.ctaSub}>ابحث عن مورد صيني مناسب</Text>
            </View>
          </TouchableOpacity>

          {/* Browse row */}
          <View style={s.browseRow}>
            <TouchableOpacity
              style={s.browseBtn}
              onPress={() => navigation.navigate('Products')}
              activeOpacity={0.8}
            >
              <Text style={s.browseBtnText}>تصفح المنتجات</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.browseBtn}
              onPress={() => navigation.navigate('Suppliers')}
              activeOpacity={0.8}
            >
              <Text style={s.browseBtnText}>الموردون</Text>
            </TouchableOpacity>
          </View>

          {/* Recent requests */}
          <View style={s.sectionHeader}>
            <TouchableOpacity onPress={() => navigation.navigate('Requests')}>
              <Text style={s.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={s.sectionTitle}>طلباتي الأخيرة</Text>
          </View>

          {requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>لا توجد طلبات بعد</Text>
              <Text style={s.emptySubText}>ارفع طلبك الأول للبدء</Text>
            </View>
          ) : (
            requests.map(r => (
              <RequestCard
                key={r.id}
                item={r}
                onPress={() => navigation.navigate('Requests', { screen: 'RequestsList' })}
              />
            ))
          )}

        </View>
      </ScrollView>
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

function RequestCard({ item, onPress }) {
  const status = item.status || 'open';
  const color = STATUS_COLOR[status] || C.blue;
  const label = STATUS_AR[status] || STATUS_AR.open;
  const title = item.title_ar || item.title_en || 'طلب';

  return (
    <TouchableOpacity style={s.reqCard} onPress={onPress} activeOpacity={0.75}>
      <View style={s.reqTop}>
        <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
          <Text style={[s.statusText, { color }]}>{label}</Text>
        </View>
        <View style={s.reqInfo}>
          <Text style={s.reqTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.reqQty}>{item.quantity}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  headerRight: { alignItems: 'flex-end' },
  greeting: { color: C.textPrimary, fontWeight: '700', fontSize: 20 },
  subGreeting: { color: C.textSecondary, fontSize: 12, marginTop: 3 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: C.bgRaised, borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.borderDefault, alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '200', color: C.textPrimary, lineHeight: 32 },
  statLabel: { fontSize: 10, color: C.textSecondary, textAlign: 'center', marginTop: 6 },

  ctaBtn: {
    backgroundColor: C.textPrimary, borderRadius: 18,
    padding: 20, flexDirection: 'row', alignItems: 'center',
    gap: 16, marginBottom: 12,
  },
  ctaIcon: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: 'rgba(10,10,11,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaPlus: { fontSize: 26, color: C.bgBase, fontWeight: '200', lineHeight: 30 },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 17, fontWeight: '800', color: C.bgBase, textAlign: 'right' },
  ctaSub: { fontSize: 12, color: 'rgba(10,10,11,0.45)', marginTop: 3, textAlign: 'right' },

  browseRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  browseBtn: {
    flex: 1, borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    backgroundColor: C.bgRaised,
  },
  browseBtnText: { color: C.textSecondary, fontSize: 13 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: C.textSecondary },
  seeAll: { fontSize: 12, color: C.accent },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontSize: 15, marginBottom: 6 },
  emptySubText: { color: C.textTertiary, fontSize: 13 },

  reqCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  reqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  reqInfo: { flex: 1, marginLeft: 12, alignItems: 'flex-end' },
  reqTitle: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  reqQty: { fontSize: 12, color: C.textSecondary, marginTop: 3 },
});
