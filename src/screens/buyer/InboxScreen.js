import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function InboxScreen({ navigation }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Get latest message per partner
    const { data } = await supabase
      .from('messages')
      .select(`
        id, content, created_at, is_read, sender_id, receiver_id,
        sender:profiles!messages_sender_id_fkey(id, full_name, company_name),
        receiver:profiles!messages_receiver_id_fkey(id, full_name, company_name)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    // Deduplicate by partner
    const seen = new Set();
    const deduped = [];
    for (const msg of (data || [])) {
      const partner = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!seen.has(partner)) {
        seen.add(partner);
        deduped.push({ ...msg, partnerId: partner });
      }
    }

    setThreads(deduped);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() { setRefreshing(true); load(); }

  function getPartnerName(thread) {
    const isSender = thread.sender_id === userId;
    const partner = isSender ? thread.receiver : thread.sender;
    return partner?.company_name || partner?.full_name || 'مجهول';
  }

  function previewContent(content) {
    if (!content) return '';
    if (content.startsWith('[img:')) return '📷 صورة';
    if (content.startsWith('[vid:')) return '🎥 فيديو';
    if (content.startsWith('[pdf:')) return '📄 ملف';
    return content.length > 50 ? content.slice(0, 50) + '...' : content;
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={s.pageTitle}>الرسائل</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : threads.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>لا توجد رسائل بعد</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {threads.map(thread => {
            const unread = !thread.is_read && thread.receiver_id === userId;
            return (
              <TouchableOpacity
                key={thread.partnerId}
                style={[s.threadRow, unread && s.threadRowUnread]}
                onPress={() => navigation.navigate('Chat', { partnerId: thread.partnerId })}
                activeOpacity={0.75}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {getPartnerName(thread).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.threadInfo}>
                  <View style={s.threadTop}>
                    <Text style={s.threadTime}>
                      {new Date(thread.created_at).toLocaleDateString('ar-SA')}
                    </Text>
                    <Text style={[s.threadName, unread && { color: C.textPrimary }]}>
                      {getPartnerName(thread)}
                    </Text>
                  </View>
                  <Text style={[s.threadPreview, unread && { color: C.textSecondary }]} numberOfLines={1}>
                    {previewContent(thread.content)}
                  </Text>
                </View>
                {unread && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'right' },

  threadRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    gap: 12,
  },
  threadRowUnread: { backgroundColor: C.bgSubtle },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.accentMuted, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.accent, fontSize: 18, fontWeight: '700' },
  threadInfo: { flex: 1 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  threadName: { color: C.textSecondary, fontSize: 15, fontWeight: '600' },
  threadTime: { color: C.textDisabled, fontSize: 11 },
  threadPreview: { color: C.textTertiary, fontSize: 13 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.accent,
  },

  emptyCard: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  emptyText: { color: C.textSecondary, fontSize: 15 },
});
