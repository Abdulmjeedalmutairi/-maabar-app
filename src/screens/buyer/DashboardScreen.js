import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import DashboardOverview from '../../components/dashboard/DashboardOverview';

export default function DashboardScreen({ navigation, route }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    requests: 0,
    messages: 0,
    offers: 0,
    productInquiries: 0,
  });
  const [requests, setRequests] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isArabic, setIsArabic] = useState(true); // Default to Arabic

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, city, preferred_language')
        .eq('id', user.id)
        .single();

      setProfile(profileData);
      if (profileData?.preferred_language) {
        setIsArabic(profileData.preferred_language === 'ar');
      }

      // Load requests
      const { data: requestsData } = await supabase
        .from('requests')
        .select(`
          id,
          title_ar,
          title_en,
          quantity,
          unit,
          status,
          created_at,
          offers(count)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const formattedRequests = (requestsData || []).map(req => ({
        ...req,
        offers_count: req.offers?.[0]?.count || 0,
      }));
      setRequests(formattedRequests);

      // Load unread messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      // Load pending offers
      const { data: offersData } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .in('request_id', formattedRequests.map(r => r.id));

      // Load product inquiries
      const { data: inquiriesData } = await supabase
        .from('product_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', user.id)
        .eq('status', 'pending');

      // Calculate stats
      setStats({
        requests: formattedRequests.filter(r => ['open', 'offers_received'].includes(r.status)).length,
        messages: messagesData?.count || 0,
        offers: offersData?.count || 0,
        productInquiries: inquiriesData?.count || 0,
      });

      // Load pending actions (offers that need response)
      const { data: pendingOffers } = await supabase
        .from('offers')
        .select(`
          id,
          request:requests(id, title_ar, title_en)
        `)
        .eq('status', 'pending')
        .in('request_id', formattedRequests.map(r => r.id))
        .limit(3);

      const actions = (pendingOffers || []).map(offer => ({
        id: offer.id,
        title_ar: `عرض جديد على: ${offer.request?.title_ar || 'طلب'}`,
        title_en: `New offer on: ${offer.request?.title_en || 'request'}`,
        count: 1,
        type: 'offer',
      }));
      setPendingActions(actions);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadData();

    // Set up real-time subscriptions
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleStatPress = (statType) => {
    switch (statType) {
      case 'requests':
        navigation.navigate('Requests');
        break;
      case 'messages':
        navigation.navigate('Inbox');
        break;
      case 'offers':
        navigation.navigate('Offers');
        break;
      case 'inquiries':
        navigation.navigate('ProductInquiries');
        break;
    }
  };

  const handleQuickActionPress = (actionId) => {
    switch (actionId) {
      case 'new-request':
        navigation.navigate('NewRequest');
        break;
      case 'browse-products':
        navigation.navigate('Products');
        break;
      case 'my-requests':
        navigation.navigate('Requests');
        break;
      case 'private-label':
        navigation.navigate('PrivateLabel');
        break;
    }
  };

  const handleRequestPress = (request) => {
    navigation.navigate('RequestDetails', { requestId: request.id });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>
          {isArabic ? 'جاري تحميل لوحة التاجر...' : 'Loading trader dashboard...'}
        </Text>
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>
            {isArabic ? 'مَعبر · لوحة التاجر' : 'Maabar · Trader Dashboard'}
          </Text>
          <Text style={styles.welcomeTitle}>
            {isArabic ? `أهلاً، ${firstName}` : `Welcome, ${firstName}`}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {isArabic ? 'تابع طلباتك وعروضك ورسائلك من مكان واحد' : 'Track your requests, offers and messages in one place'}
          </Text>
        </View>
      </View>

      {/* Dashboard Content */}
      <DashboardOverview
        profile={profile}
        stats={stats}
        requests={requests}
        pendingActions={pendingActions}
        loading={loading}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onStatPress={handleStatPress}
        onQuickActionPress={handleQuickActionPress}
        onRequestPress={handleRequestPress}
        isArabic={isArabic}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgBase,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bgBase,
  },
  loadingText: {
    marginTop: 16,
    color: C.textTertiary,
    fontSize: 14,
  },
  header: {
    backgroundColor: C.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerContent: {
    maxWidth: 500,
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: C.textDisabled,
    marginBottom: 16,
    fontWeight: '500',
    fontFamily: 'System',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: C.textPrimary,
    marginBottom: 8,
    fontFamily: 'System',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: C.textTertiary,
    lineHeight: 20,
    fontFamily: 'System',
  },
});