import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function ChatScreen({ route, navigation }) {
  const { partnerId } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [myId, setMyId] = useState(null);
  const [sending, setSending] = useState(false);
  const flatRef = useRef(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !partnerId) return;
    setMyId(user.id);

    const [partnerRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, company_name').eq('id', partnerId).single(),
      supabase.from('messages')
        .select('id, content, sender_id, created_at, is_read')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true }),
    ]);

    setPartner(partnerRes.data);
    setMessages(messagesRes.data || []);
    setLoading(false);

    // Mark as read
    supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', partnerId)
      .then(() => {});
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!myId || !partnerId) return;
    const channel = supabase
      .channel(`chat-${myId}-${partnerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, payload => {
        if (payload.new.sender_id === partnerId) {
          setMessages(prev => [...prev, payload.new]);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [myId, partnerId]);

  async function sendMessage() {
    if (!text.trim() || !myId || !partnerId) return;
    const content = text.trim();
    setText('');
    setSending(true);

    const { data } = await supabase.from('messages').insert({
      sender_id: myId,
      receiver_id: partnerId,
      content,
      is_read: false,
    }).select().single();

    if (data) setMessages(prev => [...prev, data]);
    setSending(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  const partnerName = partner?.company_name || partner?.full_name || 'محادثة';

  function renderMessage({ item }) {
    const isMe = item.sender_id === myId;
    return (
      <View style={[s.msgWrap, isMe ? s.msgWrapMe : s.msgWrapThem]}>
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextThem]}>
            {item.content}
          </Text>
        </View>
        <Text style={s.msgTime}>
          {new Date(item.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={s.headerName} numberOfLines={1}>{partnerName}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            contentContainerStyle={s.messagesList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.sendIcon}>↑</Text>}
          </TouchableOpacity>
          <TextInput
            style={s.textInput}
            value={text}
            onChangeText={setText}
            placeholder="اكتب رسالة..."
            placeholderTextColor={C.textDisabled}
            multiline
            maxLength={2000}
            textAlign="right"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  back: { color: C.accent, fontSize: 14 },
  headerName: {
    color: C.textPrimary, fontWeight: '700', fontSize: 16,
    maxWidth: '75%', textAlign: 'right',
  },

  messagesList: { padding: 16, paddingBottom: 8, gap: 10 },
  msgWrap: { maxWidth: '80%', gap: 3 },
  msgWrapMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: {
    backgroundColor: C.accent,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: C.bgRaised,
    borderWidth: 1, borderColor: C.borderDefault,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: C.textPrimary },
  msgTime: { color: C.textDisabled, fontSize: 10 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    backgroundColor: C.bgBase, gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  textInput: {
    flex: 1, backgroundColor: C.bgRaised,
    borderRadius: 22, borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 10,
    color: C.textPrimary, fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
