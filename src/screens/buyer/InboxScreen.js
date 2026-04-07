import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const COPY = {
  ar: {
    title: 'الرسائل',
    empty: 'لا توجد رسائل بعد',
    img: 'صورة',
    vid: 'فيديو',
    pdf: 'ملف',
  },
  en: {
    title: 'Messages',
    empty: 'No messages yet',
    img: 'Image',
    vid: 'Video',
    pdf: 'File',
  },
  zh: {
    title: '消息',
    empty: '暂无消息',
    img: '图片',
    vid: '视频',
    pdf: '文件',
  },
};

export default function InboxScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);

  // Exact same 2-query pattern as web Inbox.jsx
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [sent, recv] = await Promise.all([
      supabase.from('messages').select('receiver_id,content,created_at')
        .eq('sender_id', user.id).order('created_at', { ascending: false }),
      supabase.from('messages').select('sender_id,content,created_at,is_read')
        .eq('receiver_id', user.id).order('created_at', { ascending: false }),
    ]);

    console.log('[InboxScreen] sent rows:', sent.data?.length, 'recv rows:', recv.data?.length);

    const map = {};
    if (sent.data) sent.data.forEach(m => {
      if (!map[m.receiver_id] || new Date(m.created_at) > new Date(map[m.receiver_id].last_time))
        map[m.receiver_id] = { partner_id: m.receiver_id, last_msg: m.content, last_time: m.created_at, unread: 0 };
    });
    if (recv.data) recv.data.forEach(m => {
      if (!map[m.sender_id] || new Date(m.created_at) > new Date(map[m.sender_id].last_time))
        map[m.sender_id] = { partner_id: m.sender_id, last_msg: m.content, last_time: m.created_at, unread: map[m.sender_id]?.unread || 0 };
      if (!m.is_read) map[m.sender_id].unread = (map[m.sender_id].unread || 0) + 1;
    });

    const list = Object.values(map).sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
    if (!list.length) { setConvs([]); setLoading(false); setRefreshing(false); return; }

    const ids = list.map(c => c.partner_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id,full_name,company_name').in('id', ids);

    console.log('[InboxScreen] profiles fetched:', profiles?.length);

    const pm = {};
    if (profiles) profiles.forEach(p => (pm[p.id] = p));

    setConvs(list.map(c => ({ ...c, profile: pm[c.partner_id] || {} })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() { setRefreshing(true); load(); }

  const openChat = async (partnerId) => {
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', partnerId)
      .eq('is_read', false);
    setConvs(prev => prev.map(c => c.partner_id === partnerId ? { ...c, unread: 0 } : c));
    navigation.navigate('Chat', { partnerId });
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (lang === 'ar') {
      if (diff < 3600) return Math.floor(diff / 60) + ' د';
      if (diff < 86400) return Math.floor(diff / 3600) + ' س';
      return Math.floor(diff / 86400) + ' ي';
    }
    if (lang === 'zh') {
      if (diff < 3600) return Math.floor(diff / 60) + '分';
      if (diff < 86400) return Math.floor(diff / 3600) + '时';
      return Math.floor(diff / 86400) + '天';
    }
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  };

  const previewContent = (content) => {
    if (!content) return '';
    if (content.startsWith('[img:')) return `📷 ${t.img}`;
    if (content.startsWith('[vid:')) return `🎥 ${t.vid}`;
    if (content.startsWith('[pdf:')) return `📄 ${t.pdf}`;
    return content.length > 55 ? content.slice(0, 55) + '…' : content;
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={[s.pageTitle, isAr && s.rtl]}>{t.title}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.textSecondary} size="large" />
        </View>
      ) : convs.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>{t.empty}</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />
          }
        >
          {convs.map((c) => {
            const name = c.profile?.company_name || c.profile?.full_name || '—';
            return (
              <TouchableOpacity
                key={c.partner_id}
                style={[s.row, isAr && s.rowRtl]}
                onPress={() => openChat(c.partner_id)}
                activeOpacity={0.75}
              >
                <View style={[s.avatar, c.unread > 0 && s.avatarUnread]}>
                  <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={s.info}>
                  <View style={[s.infoTop, isAr && s.rowRtl]}>
                    <Text style={[s.name, c.unread > 0 && s.nameUnread]}>{name}</Text>
                    <Text style={s.time}>{fmtDate(c.last_time)}</Text>
                  </View>
                  <Text
                    style={[s.preview, isAr && s.rtl]}
                    numberOfLines={1}
                  >
                    {previewContent(c.last_msg)}
                  </Text>
                </View>

                {c.unread > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{c.unread}</Text>
                  </View>
                )}
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
  rtl: { textAlign: 'right', writingDirection: 'rtl' },

  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle: {
    color: C.textPrimary,
    fontSize: 20,
    fontFamily: F.arSemi,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    gap: 14,
  },
  rowRtl: { flexDirection: 'row-reverse' },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnread: {
    backgroundColor: C.bgHover,
    borderColor: C.borderStrong,
  },
  avatarText: {
    color: C.textSecondary,
    fontSize: 16,
    fontFamily: F.enSemi,
  },

  info: { flex: 1 },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: F.ar,
  },
  nameUnread: {
    color: C.textPrimary,
    fontFamily: F.arSemi,
  },
  time: {
    color: C.textDisabled,
    fontSize: 11,
    fontFamily: F.en,
  },
  preview: {
    color: C.textTertiary,
    fontSize: 13,
    fontFamily: F.ar,
  },

  // Dark neutral badge — no purple
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: C.textPrimary,
    fontSize: 10,
    fontFamily: F.enBold,
  },

  emptyCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },
});
