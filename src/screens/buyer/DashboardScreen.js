import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, SafeAreaView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import DashboardOverview from '../../components/dashboard/DashboardOverview';
import MaabarLogo from '../../components/MaabarLogo';

export default function DashboardScreen({ navigation, route }) {
  const [profile, setProfile]                   = useState(null);
  const [stats, setStats]                       = useState({ requests: 0, messages: 0, offers: 0, needsAction: 0 });
  const [requests, setRequests]                 = useState([]);
  const [pendingActions, setPendingActions]     = useState([]);
  const [activeOrders, setActiveOrders]         = useState([]);
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [isArabic, setIsArabic]                 = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation.navigate('Login'); return; }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, city, preferred_language')
        .eq('id', user.id)
        .single();
      setProfile(profileData);
      if (profileData?.preferred_language) setIsArabic(profileData.preferred_language === 'ar');

      /* All requests with offers */
      const { data: reqs } = await supabase
        .from('requests')
        .select('id, title_ar, title_en, status, sourcing_mode, managed_status, quantity, payment_pct, amount, payment_second, payment_second_paid, created_at, updated_at, tracking_number, shipping_company, estimated_delivery')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const rows = reqs || [];
      setRequests(rows);

      /* Load active orders (supplier_confirmed → arrived) with offer data */
      const ACTIVE_STATUSES = ['supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived'];
      const activeRows = rows.filter(r => ACTIVE_STATUSES.includes(r.status));
      if (activeRows.length > 0) {
        setActiveOrdersLoading(true);
        const activeIds = activeRows.map(r => r.id);
        const { data: offerRows } = await supabase
          .from('offers')
          .select('id, status, request_id, price, shipping_cost, currency, supplier_id, profiles(company_name, full_name, verified)')
          .in('request_id', activeIds);
        const byReq = (offerRows || []).reduce((acc, o) => {
          (acc[o.request_id] = acc[o.request_id] || []).push(o);
          return acc;
        }, {});
        setActiveOrders(activeRows.slice(0, 5).map(r => ({ ...r, offers: byReq[r.id] || [] })));
        setActiveOrdersLoading(false);
      } else {
        setActiveOrders([]);
      }

      /* Pending actions — all 8 types (web-exact) */
      const actions = [];
      if (rows.length > 0) {
        const rowIds = rows.map(r => r.id);
        const { data: offerData } = await supabase
          .from('offers')
          .select('id, status, request_id')
          .in('request_id', rowIds);
        const offersByReq = (offerData || []).reduce((acc, o) => {
          (acc[o.request_id] = acc[o.request_id] || []).push(o);
          return acc;
        }, {});
        rows.forEach(r => {
          const rowOffers  = offersByReq[r.id] || [];
          const pending    = rowOffers.filter(o => o.status === 'pending');
          const isManaged  = String(r.sourcing_mode || 'direct') === 'managed';
          const managedSt  = String(r.managed_status || '');
          if (isManaged && managedSt === 'shortlist_ready') {
            actions.push({ type: 'managed_shortlist', request: r });
          } else if (pending.length > 0) {
            actions.push({ type: 'offers', request: r, count: pending.length });
          }
          if (r.status === 'supplier_confirmed') actions.push({ type: 'supplier_confirmed', request: r });
          if (r.status === 'paid')               actions.push({ type: 'payment_sent', request: r });
          if (r.status === 'ready_to_ship')      actions.push({ type: 'ready_to_ship', request: r });
          if (r.status === 'shipping')           actions.push({ type: 'delivery', request: r });
          if (r.status === 'arrived')            actions.push({ type: 'arrived', request: r });
        });
      }
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      if (msgs?.length > 0) actions.push({ type: 'messages', count: msgs.length });
      setPendingActions(actions);

      /* Stats */
      const needsAction = rows.filter(r => ['offers_received','supplier_confirmed','arrived','ready_to_ship'].includes(r.status)).length;
      setStats({
        requests:   rows.length,
        messages:   msgs?.length || 0,
        offers:     rows.filter(r => r.status === 'offers_received').length,
        needsAction,
      });

    } catch (error) {
      console.error('DashboardScreen load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadData();
    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' },   () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>{isArabic ? 'جاري تحميل...' : 'Loading...'}</Text>
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}><MaabarLogo size="sm" /></View>
        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>{isArabic ? 'لوحة التاجر' : 'Trader Dashboard'}</Text>
          <Text style={styles.welcomeTitle}>{isArabic ? `أهلاً، ${firstName}` : `Welcome, ${firstName}`}</Text>
          <Text style={styles.welcomeSubtitle}>{isArabic ? 'تابع طلباتك وعروضك ورسائلك من مكان واحد' : 'Track your requests, offers and messages in one place'}</Text>
        </View>
      </View>

      <DashboardOverview
        profile={profile}
        stats={stats}
        requests={requests}
        pendingActions={pendingActions}
        activeOrders={activeOrders}
        activeOrdersLoading={activeOrdersLoading}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); loadData(); }}
        isArabic={isArabic}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bgBase },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgBase },
  loadingText:      { marginTop: 16, color: C.textTertiary, fontSize: 14, fontFamily: F.ar },
  header: { backgroundColor: C.bgSubtle, borderBottomWidth: 1, borderBottomColor: C.borderSubtle, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  headerTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerContent: { maxWidth: 500 },
  headerLabel:   { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.textDisabled, marginBottom: 16, fontWeight: '500', fontFamily: F.en },
  welcomeTitle:   { fontSize: 28, fontWeight: '300', color: C.textPrimary, marginBottom: 8, fontFamily: F.ar },
  welcomeSubtitle:{ fontSize: 14, color: C.textTertiary, lineHeight: 20, fontFamily: F.ar },
});
