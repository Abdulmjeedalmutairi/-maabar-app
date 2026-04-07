import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Modal, Image, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const SEND_EMAILS_URL = `${SUPABASE_URL}/functions/v1/send-email`;
const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;

// ── Translation modes ─────────────────────────────────────────────────────────
const TRANS_MODES = [
  { key: 'none',     label: 'بدون ترجمة' },
  { key: 'zh-to-ar', label: 'صيني←عربي'  },
  { key: 'ar-to-zh', label: 'عربي←صيني'  },
];

// ── Message quick-templates ───────────────────────────────────────────────────
const MSG_TEMPLATES = {
  ar: [
    { label: 'المنتج', msg: 'Can you provide more details about this product? Specifications, materials, and available colors?' },
    { label: 'السعر',  msg: 'What is the price per unit for bulk orders? Can you offer a discount for larger quantities?' },
    { label: 'MOQ',    msg: 'What is the minimum order quantity? Is there flexibility for first orders?' },
    { label: 'العينة', msg: 'Do you offer product samples? What is the sample cost and shipping time to Saudi Arabia?' },
    { label: 'الشحن',  msg: 'What shipping methods do you offer to Saudi Arabia? What is the estimated delivery time?' },
    { label: 'الدفع',  msg: 'What are your payment terms? Do you accept the Maabar platform payment system?' },
  ],
  en: [
    { label: 'Product',  msg: 'Can you provide more details about this product? Specifications, materials, and available colors?' },
    { label: 'Price',    msg: 'What is the price per unit for bulk orders? Can you offer a discount for larger quantities?' },
    { label: 'MOQ',      msg: 'What is the minimum order quantity? Is there flexibility for first orders?' },
    { label: 'Sample',   msg: 'Do you offer product samples? What is the sample cost and shipping time to Saudi Arabia?' },
    { label: 'Shipping', msg: 'What shipping methods do you offer to Saudi Arabia? What is the estimated delivery time?' },
    { label: 'Payment',  msg: 'What are your payment terms? Do you accept the Maabar platform payment system?' },
  ],
  zh: [
    { label: '产品', msg: '能提供更多产品详情吗？规格、材料和可用颜色？' },
    { label: '价格', msg: '批量订购的单价是多少？量大可以优惠吗？' },
    { label: 'MOQ',  msg: '最小起订量是多少？首次订单有灵活性吗？' },
    { label: '样品', msg: '你们提供产品样品吗？样品费用和运到沙特的时间是多少？' },
    { label: '运输', msg: '你们有哪些运到沙特的运输方式？预计到货时间是多少？' },
    { label: '付款', msg: '付款条件是什么？接受Maabar平台支付系统吗？' },
  ],
};

const COPY = {
  ar: {
    inputPlaceholder: 'اكتب رسالة...',
    quickTemplates:   'رسائل جاهزة',
    protection:       'للحماية الكاملة — أتمّ صفقتك عبر معبر',
    back:             '←',
    attach:           'مرفق',
    attachImage:      'صورة',
    attachVideo:      'فيديو',
    attachPdf:        'ملف PDF',
    cancel:           'إلغاء',
    uploading:        'جارٍ الرفع...',
    roleSupplier:     'مورّد',
    roleBuyer:        'مشتري',
    translating:      'جارٍ الترجمة...',
  },
  en: {
    inputPlaceholder: 'Type a message...',
    quickTemplates:   'Quick Templates',
    protection:       'For full protection — complete your deal on Maabar',
    back:             '←',
    attach:           'Attach',
    attachImage:      'Image',
    attachVideo:      'Video',
    attachPdf:        'PDF File',
    cancel:           'Cancel',
    uploading:        'Uploading...',
    roleSupplier:     'Supplier',
    roleBuyer:        'Buyer',
    translating:      'Translating...',
  },
  zh: {
    inputPlaceholder: '输入消息...',
    quickTemplates:   '快捷模板',
    protection:       '获得完整保障 — 通过 Maabar 完成交易',
    back:             '←',
    attach:           '附件',
    attachImage:      '图片',
    attachVideo:      '视频',
    attachPdf:        'PDF文件',
    cancel:           '取消',
    uploading:        '上传中...',
    roleSupplier:     '供应商',
    roleBuyer:        '买家',
    translating:      '翻译中...',
  },
};

// ── Grok translation ──────────────────────────────────────────────────────────
async function callGrok(text, mode) {
  if (!text || mode === 'none' || !GROK_API_KEY) return null;
  const systemPrompt =
    mode === 'zh-to-ar'
      ? 'Translate the following Chinese text to Arabic. Return only the translation, nothing else.'
      : 'Translate the following Arabic text to Chinese. Return only the translation, nothing else.';
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: text },
        ],
      }),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('[ChatScreen] grok error:', e);
    return null;
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { partnerId } = route.params || {};
  const lang      = getLang();
  const t         = COPY[lang] || COPY.ar;
  const isAr      = lang === 'ar';
  const templates = MSG_TEMPLATES[lang] || MSG_TEMPLATES.ar;

  // Core state
  const [messages,   setMessages]   = useState([]);
  const [partner,    setPartner]    = useState(null);
  const [myProfile,  setMyProfile]  = useState(null);
  const [myId,       setMyId]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [uploading,  setUploading]  = useState(false);

  // Attachment sheet
  const [attachSheet,    setAttachSheet]    = useState(false);
  // Fullscreen image viewer
  const [lightboxUrl,    setLightboxUrl]    = useState(null);

  // Translation
  const [transMode,      setTransMode]      = useState('none');
  const [transSheet,     setTransSheet]     = useState(false);
  const [translations,   setTranslations]   = useState({});  // { cacheKey: string }
  const [pendingTrans,   setPendingTrans]   = useState({});  // { cacheKey: true } in-flight

  const flatRef    = useRef(null);
  const channelRef = useRef(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !partnerId) return;
    setMyId(user.id);

    const [partnerRes, msgsRes, meRes] = await Promise.all([
      supabase.from('profiles')
        .select('id,full_name,company_name,role')
        .eq('id', partnerId)
        .single(),
      supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true }),
      supabase.from('profiles')
        .select('full_name,company_name')
        .eq('id', user.id)
        .single(),
    ]);

    setPartner(partnerRes.data);
    setMessages(msgsRes.data || []);
    setMyProfile(meRes.data);
    setLoading(false);

    await supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', partnerId)
      .eq('is_read', false);

    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('type', 'new_message')
      .eq('is_read', false);
  }, [partnerId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const reloadMessages = useCallback(async () => {
    if (!myId || !partnerId) return;
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', myId)
      .eq('sender_id', partnerId)
      .eq('is_read', false);
  }, [myId, partnerId]);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!myId || !partnerId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`chat-${myId}-${partnerId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, async (payload) => {
        const msg = payload.new;
        if (msg.sender_id !== partnerId) return;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
      })
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [myId, partnerId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 80);
  }, [messages.length]);

  // ── Translation — trigger for incoming messages when mode changes ───────────
  useEffect(() => {
    if (transMode === 'none' || !myId) return;
    messages.forEach(msg => {
      if (msg.sender_id === myId) return;          // only incoming
      if (!msg.content?.trim()) return;
      const cacheKey = `${transMode}:${msg.content}`;
      if (translations[cacheKey] || pendingTrans[cacheKey]) return;
      setPendingTrans(prev => ({ ...prev, [cacheKey]: true }));
      callGrok(msg.content, transMode).then(result => {
        setPendingTrans(prev => { const n = { ...prev }; delete n[cacheKey]; return n; });
        if (result) setTranslations(prev => ({ ...prev, [cacheKey]: result }));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transMode, messages.length, myId]);

  // ── Send text message ───────────────────────────────────────────────────────
  const sendMessage = async (content = null) => {
    const text = content || input.trim();
    if (!text || sending || !myId) return;
    if (!content) setInput('');
    setSending(true);

    const tempMsg = {
      id:          `temp-${Date.now()}`,
      sender_id:   myId,
      receiver_id: partnerId,
      content:     text,
      created_at:  new Date().toISOString(),
      is_read:     false,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

    await supabase.from('messages').insert({
      sender_id:   myId,
      receiver_id: partnerId,
      content:     text,
    });

    await supabase.from('notifications').insert({
      user_id:  partnerId,
      type:     'new_message',
      title_ar: 'رسالة جديدة من مَعبر',
      title_en: 'New message on Maabar',
      title_zh: '新消息',
      ref_id:   myId,
      is_read:  false,
    });

    try {
      await fetch(SEND_EMAILS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'new_message',
          data: {
            recipientUserId: partnerId,
            senderId:        myId,
            senderName:      myProfile?.company_name || myProfile?.full_name || 'Maabar',
            preview:         text.length > 80 ? `${text.slice(0, 80)}...` : text,
          },
        }),
      });
    } catch (e) {
      console.error('[ChatScreen] email error:', e);
    }

    setSending(false);
    reloadMessages();
  };

  // ── Upload file to Supabase Storage ─────────────────────────────────────────
  const uploadAndSend = async (uri, mimeType, attachType) => {
    if (!uri || !myId) return;
    setUploading(true);
    try {
      const ext      = uri.split('.').pop()?.split('?')[0] || 'bin';
      const fileName = `${myId}/${Date.now()}.${ext}`;

      const fetchRes = await fetch(uri);
      const blob     = await fetchRes.blob();

      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, blob, { contentType: mimeType, upsert: false });

      if (upErr) {
        console.error('[ChatScreen] upload error:', upErr);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // Optimistic message
      const tempMsg = {
        id:              `temp-${Date.now()}`,
        sender_id:       myId,
        receiver_id:     partnerId,
        content:         '',
        attachment_url:  publicUrl,
        attachment_type: attachType,
        created_at:      new Date().toISOString(),
        is_read:         false,
      };
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

      await supabase.from('messages').insert({
        sender_id:       myId,
        receiver_id:     partnerId,
        content:         '',
        attachment_url:  publicUrl,
        attachment_type: attachType,
      });

      await supabase.from('notifications').insert({
        user_id:  partnerId,
        type:     'new_message',
        title_ar: 'رسالة جديدة من مَعبر',
        title_en: 'New message on Maabar',
        title_zh: '新消息',
        ref_id:   myId,
        is_read:  false,
      });

      reloadMessages();
    } catch (e) {
      console.error('[ChatScreen] uploadAndSend error:', e);
    } finally {
      setUploading(false);
    }
  };

  // ── Attachment pickers ───────────────────────────────────────────────────────
  const pickImage = async () => {
    setAttachSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await uploadAndSend(asset.uri, asset.mimeType || 'image/jpeg', 'image');
    }
  };

  const pickVideo = async () => {
    setAttachSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 300,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await uploadAndSend(asset.uri, asset.mimeType || 'video/mp4', 'video');
    }
  };

  const pickPdf = async () => {
    setAttachSheet(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await uploadAndSend(asset.uri, 'application/pdf', 'pdf');
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmtTime = (date) => new Date(date).toLocaleTimeString(
    isAr ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' }
  );

  const fmtDate = (date) => new Date(date).toLocaleDateString(
    isAr ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US',
    { weekday: 'long', month: 'short', day: 'numeric' }
  );

  const partnerName = partner?.company_name || partner?.full_name || '—';
  const partnerRole = partner?.role === 'supplier'
    ? t.roleSupplier
    : partner?.role === 'buyer'
      ? t.roleBuyer
      : null;

  const avatarLetter = partnerName !== '—'
    ? partnerName.trim()[0]?.toUpperCase() || '؟'
    : '؟';

  const isNewChat = messages.length === 0;

  // ── Render attachment content ────────────────────────────────────────────────
  const renderAttachment = (item, isMe) => {
    const { attachment_url, attachment_type } = item;
    if (!attachment_url) return null;

    if (attachment_type === 'image') {
      return (
        <TouchableOpacity onPress={() => setLightboxUrl(attachment_url)} activeOpacity={0.9}>
          <Image
            source={{ uri: attachment_url }}
            style={s.attachImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    if (attachment_type === 'video') {
      return (
        <View style={s.attachVideo}>
          <Image
            source={{ uri: attachment_url }}
            style={s.attachImage}
            resizeMode="cover"
          />
          <View style={s.playOverlay}>
            <Text style={s.playIcon}>▶</Text>
          </View>
        </View>
      );
    }

    if (attachment_type === 'pdf') {
      const fileName = attachment_url.split('/').pop() || 'document.pdf';
      return (
        <View style={[s.attachPdf, isMe ? s.attachPdfMe : s.attachPdfThem]}>
          <Text style={[s.pdfIcon, isMe ? s.pdfIconMe : s.pdfIconThem]}>📄</Text>
          <Text
            style={[s.pdfName, isMe ? s.pdfNameMe : s.pdfNameThem]}
            numberOfLines={2}
          >
            {decodeURIComponent(fileName)}
          </Text>
          <Text style={[s.pdfDl, isMe ? s.pdfDlMe : s.pdfDlThem]}>↓</Text>
        </View>
      );
    }

    return null;
  };

  // ── Render single message row ────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    // System message — centered gray label, no bubble
    if (item.message_type === 'system') {
      return (
        <View style={s.systemWrap}>
          <Text style={s.systemText}>{item.content}</Text>
        </View>
      );
    }

    const isMe     = item.sender_id === myId;
    const dateStr  = fmtDate(item.created_at);
    const prevDate = index > 0 ? fmtDate(messages[index - 1].created_at) : null;
    const showDate = dateStr !== prevDate;
    const isTemp   = String(item.id).startsWith('temp-');

    const hasContent    = !!item.content?.trim();
    const hasAttachment = !!item.attachment_url;

    // Translation for incoming messages
    const cacheKey    = `${transMode}:${item.content}`;
    const translated  = (!isMe && transMode !== 'none' && hasContent) ? translations[cacheKey] : null;
    const translating = (!isMe && transMode !== 'none' && hasContent && !translated) ? pendingTrans[cacheKey] : false;

    return (
      <View>
        {showDate && (
          <View style={s.dateSep}>
            <View style={s.dateLine} />
            <Text style={s.dateText}>{dateStr}</Text>
            <View style={s.dateLine} />
          </View>
        )}
        <View style={[s.msgWrap, isMe ? s.msgWrapMe : s.msgWrapThem]}>
          <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
            {hasAttachment && renderAttachment(item, isMe)}
            {hasContent && (
              <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextThem, isAr && s.rtl]}>
                {item.content}
              </Text>
            )}
            {/* Translation display — incoming only */}
            {translating && (
              <Text style={[s.translationText, s.translationPending]}>
                {t.translating}
              </Text>
            )}
            {translated && !translating && (
              <Text style={s.translationText}>{translated}</Text>
            )}
          </View>
          <View style={[s.timeRow, isMe ? s.timeRowEnd : s.timeRowStart]}>
            <Text style={s.msgTime}>{fmtTime(item.created_at)}</Text>
            {isMe && (
              <Text style={[s.tick, item.is_read ? s.tickRead : s.tickSent]}>
                {isTemp ? '✓' : item.is_read ? '✓✓' : '✓✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.center}>
          <ActivityIndicator color={C.textSecondary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={[s.header, isAr && s.headerRtl]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Text style={[s.backIcon, isAr && s.backIconRtl]}>{t.back}</Text>
        </TouchableOpacity>

        <View style={s.avatar}>
          <Text style={s.avatarText}>{avatarLetter}</Text>
        </View>

        <View style={s.headerMeta}>
          <Text style={[s.headerName, isAr && s.rtl]} numberOfLines={1}>
            {partnerName}
          </Text>
          {partnerRole && (
            <Text style={[s.headerRole, isAr && s.rtl]} numberOfLines={1}>
              {partnerRole}
            </Text>
          )}
        </View>

        {/* Translation mode button */}
        <TouchableOpacity
          onPress={() => setTransSheet(true)}
          style={s.transBtn}
          hitSlop={8}
          activeOpacity={0.75}
        >
          <Text style={s.transBtnIcon}>🌐</Text>
          {transMode !== 'none' && (
            <View style={s.transActiveDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Protection banner */}
      <View style={s.protectionBar}>
        <Text style={[s.protectionText, isAr && s.rtl]}>{t.protection}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={s.messagesList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            isNewChat ? (
              <View style={s.templates}>
                <Text style={[s.templatesLabel, isAr && s.rtl]}>{t.quickTemplates}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.templateStrip}
                >
                  {templates.map((tpl, i) => (
                    <TouchableOpacity
                      key={i}
                      style={s.templateChip}
                      onPress={() => sendMessage(tpl.msg)}
                      activeOpacity={0.75}
                    >
                      <Text style={s.templateChipText}>{tpl.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
        />

        {/* ── Input bar ── */}
        <View style={[s.inputBar, isAr && s.inputBarRtl]}>
          {/* Attach button */}
          <TouchableOpacity
            onPress={() => setAttachSheet(true)}
            style={s.attachBtn}
            disabled={uploading}
            hitSlop={6}
            activeOpacity={0.75}
          >
            {uploading
              ? <ActivityIndicator size="small" color={C.textSecondary} />
              : <Text style={s.attachBtnIcon}>📎</Text>}
          </TouchableOpacity>

          <TextInput
            style={[s.textInput, isAr && s.rtl]}
            value={input}
            onChangeText={setInput}
            placeholder={t.inputPlaceholder}
            placeholderTextColor={C.textDisabled}
            multiline
            maxLength={2000}
            textAlign={isAr ? 'right' : 'left'}
          />

          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color={C.bgBase} size="small" />
              : <Text style={s.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Attachment bottom sheet ── */}
      <Modal
        visible={attachSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachSheet(false)}
      >
        <Pressable style={s.sheetOverlay} onPress={() => setAttachSheet(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />

            <TouchableOpacity style={s.sheetRow} onPress={pickImage} activeOpacity={0.75}>
              <Text style={s.sheetRowIcon}>🖼</Text>
              <Text style={[s.sheetRowText, isAr && s.rtl]}>{t.attachImage}</Text>
            </TouchableOpacity>

            <View style={s.sheetDivider} />

            <TouchableOpacity style={s.sheetRow} onPress={pickVideo} activeOpacity={0.75}>
              <Text style={s.sheetRowIcon}>🎬</Text>
              <Text style={[s.sheetRowText, isAr && s.rtl]}>{t.attachVideo}</Text>
            </TouchableOpacity>

            <View style={s.sheetDivider} />

            <TouchableOpacity style={s.sheetRow} onPress={pickPdf} activeOpacity={0.75}>
              <Text style={s.sheetRowIcon}>📄</Text>
              <Text style={[s.sheetRowText, isAr && s.rtl]}>{t.attachPdf}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.sheetCancel}
              onPress={() => setAttachSheet(false)}
              activeOpacity={0.75}
            >
              <Text style={s.sheetCancelText}>{t.cancel}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Translation mode sheet ── */}
      <Modal
        visible={transSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setTransSheet(false)}
      >
        <Pressable style={s.sheetOverlay} onPress={() => setTransSheet(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />

            {TRANS_MODES.map((mode, i) => (
              <React.Fragment key={mode.key}>
                {i > 0 && <View style={s.sheetDivider} />}
                <TouchableOpacity
                  style={s.sheetRow}
                  onPress={() => { setTransMode(mode.key); setTransSheet(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.sheetRowText, { flex: 1 }, isAr && s.rtl]}>{mode.label}</Text>
                  {transMode === mode.key && (
                    <Text style={s.transModeCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              </React.Fragment>
            ))}

            <TouchableOpacity
              style={s.sheetCancel}
              onPress={() => setTransSheet(false)}
              activeOpacity={0.75}
            >
              <Text style={s.sheetCancelText}>{t.cancel}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Fullscreen image lightbox ── */}
      <Modal
        visible={!!lightboxUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <Pressable style={s.lightbox} onPress={() => setLightboxUrl(null)}>
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={s.lightboxImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={s.lightboxClose}
            onPress={() => setLightboxUrl(null)}
            hitSlop={12}
          >
            <Text style={s.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl:    { textAlign: 'right', writingDirection: 'rtl' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    gap: 10,
    backgroundColor: '#FAF8F5',
  },
  headerRtl:    { flexDirection: 'row-reverse' },
  backBtn:      { padding: 4 },
  backIcon:     { color: 'rgba(0,0,0,0.45)', fontSize: 20 },
  backIconRtl:  { transform: [{ scaleX: -1 }] },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'rgba(0,0,0,0.45)',
    fontSize: 14,
    fontFamily: F.arSemi,
  },

  headerMeta: { flex: 1 },
  headerName: {
    color: 'rgba(0,0,0,0.88)',
    fontSize: 15,
    fontFamily: F.arSemi,
    lineHeight: 20,
  },
  headerRole: {
    color: 'rgba(0,0,0,0.35)',
    fontSize: 11,
    fontFamily: F.ar,
    lineHeight: 16,
  },

  // Translation button
  transBtn: {
    padding: 6,
    position: 'relative',
  },
  transBtnIcon: { fontSize: 18 },
  transActiveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2D6A4F',
  },

  // ── Protection banner ──
  protectionBar: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#F5F2EE',
  },
  protectionText: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.30)',
    textAlign: 'center',
    fontFamily: F.ar,
    letterSpacing: 0.2,
  },

  // ── Messages list ──
  messagesList: { padding: 16, paddingBottom: 8 },

  // ── Date separator ──
  dateSep:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  dateText: { color: 'rgba(0,0,0,0.25)', fontSize: 11, fontFamily: F.ar },

  // ── System message ──
  systemWrap: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 24,
  },
  systemText: {
    color: 'rgba(0,0,0,0.35)',
    fontSize: 11,
    fontFamily: F.ar,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 17,
  },

  // ── Message bubbles ──
  msgWrap:     { maxWidth: '78%', marginBottom: 4 },
  msgWrapMe:   { alignSelf: 'flex-end',   alignItems: 'flex-end' },
  msgWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: { borderRadius: 18, overflow: 'hidden' },
  bubbleMe: {
    backgroundColor: '#1a1a1a',
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText:     { fontSize: 15, lineHeight: 22, fontFamily: F.ar },
  bubbleTextMe:   { color: '#FFFFFF' },
  bubbleTextThem: { color: 'rgba(0,0,0,0.88)' },

  // Translation text below incoming message
  translationText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: F.ar,
    fontStyle: 'italic',
    color: 'rgba(0,0,0,0.40)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 5,
  },
  translationPending: {
    color: 'rgba(0,0,0,0.25)',
  },

  // ── Time + read receipt ──
  timeRow:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  timeRowEnd:   { justifyContent: 'flex-end' },
  timeRowStart: { justifyContent: 'flex-start' },
  msgTime:      { color: 'rgba(0,0,0,0.25)', fontSize: 10, fontFamily: F.en },
  tick:         { fontSize: 10, letterSpacing: -0.5 },
  tickSent:     { color: 'rgba(0,0,0,0.25)' },
  tickRead:     { color: '#2D6A4F' },

  // ── Attachments ──
  attachImage: {
    width: 200,
    height: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  attachVideo: { position: 'relative' },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 12,
  },
  playIcon: { color: '#FFFFFF', fontSize: 30 },

  attachPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
    maxWidth: 220,
  },
  attachPdfMe:   {},
  attachPdfThem: {},
  pdfIcon:    { fontSize: 22 },
  pdfIconMe:  {},
  pdfIconThem:{},
  pdfName: { flex: 1, fontSize: 13, fontFamily: F.ar, lineHeight: 18 },
  pdfNameMe:   { color: '#FFFFFF' },
  pdfNameThem: { color: 'rgba(0,0,0,0.88)' },
  pdfDl:    { fontSize: 16 },
  pdfDlMe:  { color: 'rgba(255,255,255,0.7)' },
  pdfDlThem:{ color: 'rgba(0,0,0,0.40)' },

  // ── Quick templates ──
  templates:      { paddingBottom: 12 },
  templatesLabel: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.25)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: F.en,
  },
  templateStrip:    { gap: 8, paddingRight: 4 },
  templateChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    borderRadius: 20,
  },
  templateChipText: { color: 'rgba(0,0,0,0.45)', fontSize: 12, fontFamily: F.ar },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FAF8F5',
    gap: 8,
  },
  inputBarRtl: { flexDirection: 'row-reverse' },

  attachBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtnIcon: { fontSize: 22 },

  textInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: 'rgba(0,0,0,0.88)',
    fontSize: 15,
    maxHeight: 120,
    fontFamily: F.ar,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.30 },
  sendIcon:        { color: '#FFFFFF', fontSize: 18, fontFamily: F.enBold },

  // ── Bottom sheets (attach + translation) ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
  },
  sheetRowIcon: { fontSize: 22 },
  sheetRowText: {
    fontSize: 16,
    fontFamily: F.ar,
    color: 'rgba(0,0,0,0.88)',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 24,
  },
  sheetCancel: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: '#F5F2EE',
    borderRadius: 14,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 15,
    fontFamily: F.arSemi,
    color: 'rgba(0,0,0,0.55)',
  },
  transModeCheck: {
    fontSize: 16,
    color: '#2D6A4F',
    fontFamily: F.enBold,
  },

  // ── Lightbox ──
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '85%',
  },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: F.enBold,
  },
});
