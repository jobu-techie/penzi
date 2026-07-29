import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { clearToken } from '../utils/tokenStorage';
import { COLORS, SHADOWS } from '../theme';

// ── Constants ────────────────────────────────────────────────────────────────
const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',"Murang'a",
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu',
  'Siaya','Taita Taveta','Tana River','Tharaka Nithi','Trans Nzoia','Turkana',
  'Uasin Gishu','Vihiga','Wajir','West Pokot',
];

const TABS = [
  { key: 'search',        label: 'Find',       badgeKey: null },
  { key: 'chat',          label: 'Chat',        badgeKey: 'chat' },
  { key: 'interests',     label: 'Interests',   badgeKey: 'interests' },
  { key: 'notifications', label: 'Matches',     badgeKey: 'matches' },
  { key: 'dashboard',     label: 'Dashboard',   badgeKey: null },
  { key: 'settings',      label: 'Settings',    badgeKey: null },
];

const hashPhone = (phone) => {
  if (!phone) return '';
  return '*'.repeat(phone.length - 3) + phone.slice(-3);
};


// ── Subscribe Modal ──────────────────────────────────────────────────────────
function SubscribeModal({ visible, onClose, phone, onSuccess }) {
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState('plans'); // plans | waiting | success | failed
  const [paying, setPaying]   = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [message, setMessage] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setStep('plans'); setPlans([]); setMessage(''); setPaying(null);
    setLoading(true);
    api.get('/subscription/plans')
      .then(r => setPlans(r.data))
      .catch(() => setMessage('Could not load plans.'))
      .finally(() => setLoading(false));
    return () => clearInterval(pollRef.current);
  }, [visible]);

  const pollStatus = useCallback((pmtId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 24) {
        clearInterval(pollRef.current);
        setStep('failed');
        setMessage('Payment timed out. Please try again.');
        return;
      }
      try {
        const res = await api.get(`/subscription/payment/${pmtId}/status`);
        const s = res.data?.status;
        if (s === 'completed') {
          clearInterval(pollRef.current);
          setStep('success');
          setTimeout(() => { onSuccess?.(); onClose(); }, 2500);
        } else if (s === 'failed' || s === 'cancelled') {
          clearInterval(pollRef.current);
          setStep('failed');
          setMessage('Payment was not completed. You can try again.');
        }
      } catch { /* keep polling */ }
    }, 5000);
  }, [onClose, onSuccess]);

  const handleSubscribe = async (plan) => {
    setPaying(plan.id);
    setMessage('');
    try {
      const res = await api.post('/subscription/subscribe', {
        plan_id: plan.id,
        phone_number: phone,
      });
      setPaymentId(res.data.payment_id);
      setStep('waiting');
      pollStatus(res.data.payment_id);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Payment initiation failed.');
      setPaying(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          {/* Header */}
          <View style={modal.header}>
            <View>
              <Text style={modal.headerTitle}>Upgrade to Premium ✨</Text>
              <Text style={modal.headerSub}>Unlimited searches & more</Text>
            </View>
            {step !== 'waiting' && (
              <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
                <Text style={modal.closeX}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={modal.body}>
            {/* Plans step */}
            {step === 'plans' && (
              <>
                {loading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 32 }} />
                ) : (
                  <>
                    {plans.filter(p => p.name !== 'free').map(plan => (
                      <View key={plan.id} style={modal.planCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={modal.planName}>
                            {plan.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Text>
                          <Text style={modal.planDesc}>{plan.description}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                          <Text style={modal.planPrice}>KES {plan.price_kes}</Text>
                          <TouchableOpacity
                            style={[modal.payBtn, paying === plan.id && { opacity: 0.6 }]}
                            onPress={() => handleSubscribe(plan)}
                            disabled={paying === plan.id}
                          >
                            {paying === plan.id
                              ? <ActivityIndicator color={COLORS.white} size="small" />
                              : <Text style={modal.payBtnText}>Pay via M-Pesa</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {message ? <Text style={modal.errorText}>{message}</Text> : null}
                  </>
                )}
              </>
            )}

            {/* Waiting step */}
            {step === 'waiting' && (
              <View style={modal.stepCenter}>
                <ActivityIndicator color={COLORS.green} size="large" style={{ marginBottom: 16 }} />
                <Text style={modal.stepTitle}>Check your phone! 📱</Text>
                <Text style={modal.stepSub}>An M-Pesa STK push has been sent to</Text>
                <Text style={[modal.stepSub, { color: COLORS.primary, fontWeight: '700', marginTop: 4 }]}>{phone}</Text>
                <Text style={[modal.stepSub, { marginTop: 12 }]}>Enter your M-Pesa PIN to complete payment.</Text>
                <View style={modal.infoBanner}>
                  <Text style={modal.infoText}>⏱ Waiting for confirmation... This may take up to 30 seconds after you enter your PIN.</Text>
                </View>
                <TouchableOpacity onPress={() => { clearInterval(pollRef.current); setStep('plans'); setPaying(null); }}>
                  <Text style={modal.cancelText}>Cancel & go back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Success step */}
            {step === 'success' && (
              <View style={modal.stepCenter}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
                <Text style={modal.stepTitle}>Payment Confirmed!</Text>
                <Text style={modal.stepSub}>Welcome to Premium. Enjoy unlimited searches!</Text>
              </View>
            )}

            {/* Failed step */}
            {step === 'failed' && (
              <View style={modal.stepCenter}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>❌</Text>
                <Text style={modal.stepTitle}>Payment Not Completed</Text>
                <Text style={modal.stepSub}>{message}</Text>
                <TouchableOpacity
                  style={[modal.payBtn, { marginTop: 16, paddingHorizontal: 32 }]}
                  onPress={() => { setStep('plans'); setPaying(null); setMessage(''); }}
                >
                  <Text style={modal.payBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 32 },
  header:      { backgroundColor: COLORS.primary, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeX:      { color: COLORS.white, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  body:        { padding: 20 },
  planCard:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: 14, padding: 14, marginBottom: 12 },
  planName:    { fontWeight: '700', color: COLORS.gray800, fontSize: 15, textTransform: 'capitalize' },
  planDesc:    { color: COLORS.gray400, fontSize: 12, marginTop: 2 },
  planPrice:   { fontWeight: '800', color: COLORS.primary, fontSize: 16, marginBottom: 8 },
  payBtn:      { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, minWidth: 120, alignItems: 'center' },
  payBtnText:  { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  errorText:   { color: '#EF4444', fontSize: 13, textAlign: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, marginTop: 8 },
  stepCenter:  { alignItems: 'center', paddingVertical: 16 },
  stepTitle:   { fontWeight: '800', color: COLORS.gray800, fontSize: 18, marginBottom: 8 },
  stepSub:     { color: COLORS.gray500, fontSize: 14, textAlign: 'center' },
  infoBanner:  { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 12, marginTop: 16, marginBottom: 8 },
  infoText:    { color: '#166534', fontSize: 12, textAlign: 'center' },
  cancelText:  { color: COLORS.gray400, fontSize: 13, marginTop: 12, textDecorationLine: 'underline' },
});


// ── County Picker Modal ──────────────────────────────────────────────────────
function CountyPicker({ visible, selected, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = KENYA_COUNTIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={picker.overlay}>
        <View style={picker.sheet}>
          <View style={picker.header}>
            <Text style={picker.title}>Select County</Text>
            <TouchableOpacity onPress={onClose}><Text style={picker.closeX}>×</Text></TouchableOpacity>
          </View>
          <TextInput
            style={picker.search}
            placeholder="Search county..."
            placeholderTextColor={COLORS.gray400}
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[picker.item, item === selected && picker.itemSelected]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={[picker.itemText, item === selected && picker.itemTextSelected]}>{item}</Text>
                {item === selected && <Text style={{ color: COLORS.primary }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const picker = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 32 },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title:            { fontWeight: '800', fontSize: 17, color: COLORS.gray800 },
  closeX:           { fontSize: 26, color: COLORS.gray400, fontWeight: '700' },
  search:           { marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: 12, padding: 12, fontSize: 15, color: COLORS.gray800 },
  item:             { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  itemSelected:     { backgroundColor: '#FDF2F8' },
  itemText:         { fontSize: 15, color: COLORS.gray700 },
  itemTextSelected: { color: COLORS.primary, fontWeight: '700' },
});


// ── Chat Thread Item ─────────────────────────────────────────────────────────
function ChatThreadItem({ thread, onPress }) {
  const { other_user, last_message, unread_count, interest_status } = thread;
  return (
    <TouchableOpacity style={ct.card} onPress={onPress} activeOpacity={0.8}>
      <View style={ct.avatarWrap}>
        <View style={ct.avatar}>
          <Text style={ct.avatarText}>{(other_user.name || '?')[0].toUpperCase()}</Text>
        </View>
        {unread_count > 0 && (
          <View style={ct.badge}><Text style={ct.badgeText}>{unread_count}</Text></View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={ct.name} numberOfLines={1}>{other_user.name}</Text>
          {last_message && (
            <Text style={ct.time}>
              {new Date(last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <Text style={ct.preview} numberOfLines={1}>
          {last_message ? last_message.content : 'No messages yet — say hello! 👋'}
        </Text>
        <View style={[ct.statusBadge, interest_status === 'accepted' ? ct.statusGreen : ct.statusYellow]}>
          <Text style={[ct.statusText, interest_status === 'accepted' ? ct.statusTextGreen : ct.statusTextYellow]}>
            {interest_status === 'accepted' ? 'Matched ✓' : 'Interest sent'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const ct = StyleSheet.create({
  card:            { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, ...SHADOWS.card },
  avatarWrap:      { position: 'relative' },
  avatar:          { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { color: COLORS.white, fontWeight: '800', fontSize: 20 },
  badge:           { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:       { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  name:            { fontWeight: '700', color: COLORS.gray800, fontSize: 15, flex: 1 },
  time:            { fontSize: 11, color: COLORS.gray400, marginLeft: 8 },
  preview:         { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  statusBadge:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  statusGreen:     { backgroundColor: '#F0FDF4' },
  statusYellow:    { backgroundColor: '#FEFCE8' },
  statusText:      { fontSize: 11, fontWeight: '700' },
  statusTextGreen: { color: '#16A34A' },
  statusTextYellow:{ color: '#A16207' },
});


// ── Chat Window ──────────────────────────────────────────────────────────────
function ChatWindow({ thread, myPhone, onBack, onHasChatted }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const flatRef  = useRef(null);
  const pollRef  = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/chat/messages/${thread.interest_request_id}/${myPhone}`);
      setMessages(res.data);
      const mySent = res.data.filter(m => m.sender_id !== thread.other_user.id).length;
      if (mySent > 0) onHasChatted?.(thread.interest_request_id);
    } catch (e) {
      console.error('fetchMessages', e);
    } finally {
      setLoading(false);
    }
  }, [thread, myPhone, onHasChatted]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 4000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    const optimistic = { id: `opt_${Date.now()}`, sender_id: -1, content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    try {
      const res = await api.post('/chat/send', {
        sender_phone: myPhone,
        interest_request_id: thread.interest_request_id,
        content,
      });
      setMessages(prev => [...prev.filter(m => m.id !== optimistic.id), res.data]);
      onHasChatted?.(thread.interest_request_id);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      Alert.alert('Error', err.response?.data?.error || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const isMe = (msg) => msg.sender_id !== thread.other_user.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      {/* Chat header */}
      <View style={cw.header}>
        <TouchableOpacity onPress={onBack} style={cw.backBtn}>
          <Text style={cw.backText}>←</Text>
        </TouchableOpacity>
        <View style={cw.headerAvatar}>
          <Text style={cw.headerAvatarText}>{(thread.other_user.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cw.headerName}>{thread.other_user.name}</Text>
          <Text style={cw.headerSub}>Age {thread.other_user.age} · {thread.other_user.county}</Text>
        </View>
        <View style={[cw.statusPill, thread.interest_status === 'accepted' ? cw.statusGreen : cw.statusYellow]}>
          <Text style={[cw.statusText, thread.interest_status === 'accepted' ? cw.statusTextGreen : cw.statusTextYellow]}>
            {thread.interest_status === 'accepted' ? 'Matched ✓' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={cw.infoBanner}>
        <Text style={cw.infoText}>💬 Send at least one message to unlock the Accept/Decline flow.</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>👋</Text>
              <Text style={{ color: COLORS.gray400 }}>Say hello to {thread.other_user.name}!</Text>
            </View>
          }
          renderItem={({ item: msg }) => (
            <View style={[cw.msgRow, isMe(msg) ? cw.msgRowMe : cw.msgRowThem]}>
              <View style={[cw.bubble, isMe(msg) ? cw.bubbleMe : cw.bubbleThem]}>
                <Text style={[cw.msgText, isMe(msg) ? cw.msgTextMe : cw.msgTextThem]}>{msg.content}</Text>
                <Text style={[cw.msgTime, isMe(msg) ? cw.msgTimeMe : cw.msgTimeThem]}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Input bar */}
      <View style={cw.inputBar}>
        <TextInput
          style={cw.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.gray400}
          maxLength={1000}
          multiline
        />
        <TouchableOpacity
          style={[cw.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <Text style={cw.sendIcon}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const cw = StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  backBtn:          { padding: 6 },
  backText:         { color: COLORS.primary, fontSize: 22, fontWeight: '700' },
  headerAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  headerName:       { fontWeight: '700', color: COLORS.gray800, fontSize: 15 },
  headerSub:        { fontSize: 11, color: COLORS.gray400 },
  statusPill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusGreen:      { backgroundColor: '#F0FDF4' },
  statusYellow:     { backgroundColor: '#FEFCE8' },
  statusText:       { fontSize: 11, fontWeight: '700' },
  statusTextGreen:  { color: '#16A34A' },
  statusTextYellow: { color: '#A16207' },
  infoBanner:       { backgroundColor: '#FDF2F8', borderWidth: 1, borderColor: '#FBCFE8', borderRadius: 10, padding: 10, marginVertical: 8 },
  infoText:         { color: COLORS.primary, fontSize: 12 },
  msgRow:           { marginBottom: 8, flexDirection: 'row' },
  msgRowMe:         { justifyContent: 'flex-end' },
  msgRowThem:       { justifyContent: 'flex-start' },
  bubble:           { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:         { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem:       { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOWS.card },
  msgText:          { fontSize: 14 },
  msgTextMe:        { color: COLORS.white },
  msgTextThem:      { color: COLORS.gray800 },
  msgTime:          { fontSize: 10, marginTop: 3 },
  msgTimeMe:        { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  msgTimeThem:      { color: COLORS.gray400 },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.gray100, gap: 10 },
  input:            { flex: 1, borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.gray800, backgroundColor: COLORS.gray50, maxHeight: 100 },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendIcon:         { color: COLORS.white, fontSize: 18 },
});


// ── Main MatchesScreen ───────────────────────────────────────────────────────
export default function MatchesScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [phone, setPhone]             = useState('');
  const [activeTab, setActiveTab]     = useState('search');

  // Search
  const [ageMin, setAgeMin]             = useState('');
  const [ageMax, setAgeMax]             = useState('');
  const [county, setCounty]             = useState('');
  const [countyPickerVisible, setCountyPickerVisible] = useState(false);
  const [searchMsg, setSearchMsg]       = useState('');
  const [matches, setMatches]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [searched, setSearched]         = useState(false);
  const [interestStatus, setInterestStatus] = useState({});
  const [expandedMatch, setExpandedMatch]   = useState(null);

  // Interests
  const [pendingInterests, setPendingInterests]       = useState([]);
  const [acceptedInterests, setAcceptedInterests]     = useState([]);
  const [respondedInterests, setRespondedInterests]   = useState([]);
  const [responding, setResponding]                   = useState({});

  // Dashboard
  const [sentInterests, setSentInterests]     = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardFilter, setDashboardFilter]   = useState(null);
  const [expandedMatch2, setExpandedMatch2]     = useState(null);

  // Chat
  const [chatThreads, setChatThreads]         = useState([]);
  const [chatLoading, setChatLoading]         = useState(false);
  const [activeChatThread, setActiveChatThread] = useState(null);
  const [chattedInterests, setChattedInterests] = useState(new Set());
  const [unreadCount, setUnreadCount]           = useState(0);

  // Subscription
  const [subscription, setSubscription]         = useState(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // Settings
  const [profileData, setProfileData]           = useState(null);
  const [profileLoading, setProfileLoading]     = useState(false);
  const [editingProfile, setEditingProfile]     = useState(false);
  const [editForm, setEditForm]                 = useState({});
  const [editMessage, setEditMessage]           = useState({ text: '', type: '' });
  const [savingProfile, setSavingProfile]       = useState(false);
  const [currentPw, setCurrentPw]               = useState('');
  const [newPw, setNewPw]                       = useState('');
  const [confirmPw, setConfirmPw]               = useState('');
  const [pwLoading, setPwLoading]               = useState(false);
  const [pwMessage, setPwMessage]               = useState({ text: '', type: '' });
  const [showCurrentPw, setShowCurrentPw]       = useState(false);
  const [showNewPw, setShowNewPw]               = useState(false);
  const [showConfirmPw, setShowConfirmPw]       = useState(false);
  const [editCountyPickerVisible, setEditCountyPickerVisible] = useState(false);

  // ── Init ──
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('penzi_user');
      if (!raw) { navigation.replace('Login'); return; }
      const u = JSON.parse(raw);
      setCurrentUser(u);
      setPhone(u.phone_number || '');
    })();
  }, []);

  useEffect(() => {
    if (!phone) return;
    fetchPendingInterests();
    fetchAcceptedInterests();
    fetchSubscription();
    fetchUnreadCount();
    const iv = setInterval(() => {
      fetchPendingInterests();
      fetchAcceptedInterests();
      fetchUnreadCount();
    }, 10000);
    return () => clearInterval(iv);
  }, [phone]);

  // ── Fetchers ──
const fetchSubscription = useCallback(async () => {
  if (!phone) return;
  try {
    const res = await api.get('/subscription/subscription/status');
    const d = res.data;
    const planName = d.subscription?.plan?.name ?? 'free';
    setSubscription({
      plan:           planName,
      searches_used:  d.searches_today      ?? 0,
      searches_limit: d.daily_search_limit  ?? 10,
      coins:          d.coin_balance        ?? 0,
      expires_at:     d.subscription?.expires_at ?? null,
      is_premium:     d.is_premium          ?? false,
    });
  } catch (err) {
    console.error('fetchSubscription', err.response?.status, err.response?.data);
  }
}, [phone]);

  const fetchPendingInterests = useCallback(async () => {
    if (!phone) return;
    try { const r = await api.get(`/interest/pending/${phone}`); setPendingInterests(r.data); }
    catch (e) { console.error('fetchPending', e); }
  }, [phone]);

  const fetchAcceptedInterests = useCallback(async () => {
    if (!phone) return;
    try { const r = await api.get(`/interest/accepted/${phone}`); setAcceptedInterests(r.data); }
    catch (e) { console.error('fetchAccepted', e); }
  }, [phone]);

  const fetchSentInterests = useCallback(async () => {
    if (!phone) return;
    setDashboardLoading(true);
    try { const r = await api.get(`/interest/sent/${phone}`); setSentInterests(r.data); }
    catch (e) { console.error('fetchSent', e); }
    finally { setDashboardLoading(false); }
  }, [phone]);

  const fetchChatThreads = useCallback(async () => {
    if (!phone) return;
    setChatLoading(true);
    try {
      const r = await api.get(`/chat/threads/${phone}`);
      setChatThreads(r.data);
      const chatted = new Set(
        r.data.filter(t => t.last_message && t.last_message.sender_id !== t.other_user.id)
               .map(t => t.interest_request_id)
      );
      setChattedInterests(chatted);
    } catch (e) { console.error('fetchChat', e); }
    finally { setChatLoading(false); }
  }, [phone]);

  const fetchUnreadCount = useCallback(async () => {
    if (!phone) return;
    try { const r = await api.get(`/chat/unread-count/${phone}`); setUnreadCount(r.data.unread_count || 0); }
    catch { }
  }, [phone]);

  const fetchProfile = useCallback(async () => {
    if (!phone) return;
    setProfileLoading(true);
    try { const r = await api.get(`/users/phone/${phone}`); setProfileData(r.data); }
    catch (e) { console.error('fetchProfile', e); }
    finally { setProfileLoading(false); }
  }, [phone]);

  // ── SMS helpers ──
  const sendSms = (msg) => api.post('/webhook/onfon', { sender: phone, message: msg });

  const parseMatches = (text) =>
    text.split('\n')
      .filter(l => l.includes('aged') && l.includes(','))
      .map(l => {
        const parts = l.split(',');
        const nameParts = parts[0].split(' aged ');
        return { name: nameParts[0]?.trim(), age: nameParts[1]?.trim(), phone: parts[1]?.trim() };
      });

  const handleSearch = async () => {
    if (!ageMin || !ageMax || !county) { setSearchMsg('Please fill in all fields.'); return; }
    const isPremiumUser = subscription?.plan !== 'free';
    if (!isPremiumUser && (subscription?.searches_used ?? 0) >= (subscription?.searches_limit ?? 10)) {
      setShowSubscribeModal(true); return;
    }
    setSearching(true); setSearchMsg(''); setMatches([]); setExpandedMatch(null);
    try {
      const res = await sendSms(`match#${ageMin}-${ageMax}#${county}`);
      const text = res.data;
      setSearchMsg(text);
      setMatches(parseMatches(text));
      setSearched(true);
      fetchSubscription();
    } catch (err) {
      if (err.response?.status === 409) { setSearchMsg('You already have a match request. Tap Search Again to reset.'); setSearched(true); }
      else if (err.response?.status === 429) { setShowSubscribeModal(true); }
      else { setSearchMsg('Failed to search. Please try again.'); }
    } finally { setSearching(false); }
  };

  const handleNext = async () => {
    setSearching(true);
    try {
      const res = await sendSms('NEXT');
      setSearchMsg(res.data);
      setMatches(prev => [...prev, ...parseMatches(res.data)]);
    } catch { setSearchMsg('No more matches available.'); }
    finally { setSearching(false); }
  };

  const handleSearchAgain = async () => {
    setSearching(true);
    try {
      const userRes = await api.get(`/users/phone/${phone}`);
      await api.delete(`/match/reset/${userRes.data.id}`);
      setSearchMsg(''); setSearched(false); setMatches([]);
      setAgeMin(''); setAgeMax(''); setCounty('');
      setInterestStatus({}); setExpandedMatch(null);
    } catch { setSearchMsg('Failed to reset. Please try again.'); }
    finally { setSearching(false); }
  };

  const handleInterest = async (matchPhone) => {
    setSearching(true);
    try {
      const res = await sendSms(matchPhone);
      setInterestStatus(prev => ({ ...prev, [matchPhone]: res.data }));
      setTimeout(fetchChatThreads, 1000);
    } catch (err) {
      setInterestStatus(prev => ({
        ...prev,
        [matchPhone]: err.response?.status === 409 ? 'Interest already sent.' : 'Failed to send interest.',
      }));
    } finally { setSearching(false); }
  };

  const handleRespond = async (interest, response) => {
    const hasChat = chattedInterests.has(interest.interest_request_id);
    if (!hasChat) {
      Alert.alert('Chat first!', 'Please send at least one message before accepting or declining.');
      setActiveTab('chat'); fetchChatThreads(); return;
    }
    const id = interest.interest_request_id;
    setResponding(prev => ({ ...prev, [id]: true }));
    try {
      await sendSms(response);
      setPendingInterests(prev => prev.filter(i => i.interest_request_id !== id));
      setRespondedInterests(prev => [...prev, { ...interest, myResponse: response === 'YES' ? 'accepted' : 'declined' }]);
      fetchAcceptedInterests();
    } catch (e) { console.error('handleRespond', e); }
    finally { setResponding(prev => ({ ...prev, [id]: false })); }
  };

  const markHasChatted = useCallback((interestId) => {
    setChattedInterests(prev => new Set([...prev, interestId]));
  }, []);

  const handlePasswordChange = async () => {
    setPwMessage({ text: '', type: '' });
    if (!currentPw || !newPw || !confirmPw) { setPwMessage({ text: 'Please fill in all fields.', type: 'error' }); return; }
    if (newPw.length < 6) { setPwMessage({ text: 'New password must be at least 6 characters.', type: 'error' }); return; }
    if (newPw !== confirmPw) { setPwMessage({ text: 'New passwords do not match.', type: 'error' }); return; }
    setPwLoading(true);
    try {
      await api.post('/users/change-password', { phone, current_password: currentPw, new_password: newPw });
      setPwMessage({ text: 'Password changed successfully!', type: 'success' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMessage({ text: err.response?.data?.message || 'Failed to change password.', type: 'error' });
    } finally { setPwLoading(false); }
  };

  const handleProfileUpdate = async () => {
    setSavingProfile(true); setEditMessage({ text: '', type: '' });
    try {
      await api.post('/users/update-profile', { phone, ...editForm });
      setEditMessage({ text: 'Profile updated successfully!', type: 'success' });
      setEditingProfile(false); fetchProfile();
    } catch (err) {
      setEditMessage({ text: err.response?.data?.message || 'Failed to update profile.', type: 'error' });
    } finally { setSavingProfile(false); }
  };

  const handleLogout = async () => {
    await clearToken();
    await AsyncStorage.removeItem('penzi_user');
    navigation.replace('Login');
  };

  // ── Derived ──
  const isPremium = subscription?.plan && subscription.plan !== 'free';
  const totalSent     = sentInterests.length;
  const totalAccepted = sentInterests.filter(i => i.status === 'accepted').length;
  const totalDeclined = sentInterests.filter(i => i.status === 'declined').length;
  const totalPending  = sentInterests.filter(i => i.status === 'pending').length;
  const filteredSent  = dashboardFilter ? sentInterests.filter(i => i.status === dashboardFilter) : sentInterests;

  const badges = {
    chat: unreadCount,
    interests: pendingInterests.length,
    matches: acceptedInterests.length,
  };

  // ── Tab switching ──
  const switchTab = (key) => {
    setActiveTab(key);
    setActiveChatThread(null);
    if (key === 'interests')     fetchPendingInterests();
    if (key === 'notifications') fetchAcceptedInterests();
    if (key === 'dashboard')     fetchSentInterests();
    if (key === 'chat')          fetchChatThreads();
    if (key === 'settings')      fetchProfile();
  };

  // ── Render helpers ──
  const ProfileField = ({ label, value }) => (
    <View style={s.profileField}>
      <Text style={s.profileFieldLabel}>{label}</Text>
      <Text style={s.profileFieldValue}>{value || <Text style={{ color: COLORS.gray300, fontStyle: 'italic' }}>Not set</Text>}</Text>
    </View>
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.gray100 }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <SubscribeModal
        visible={showSubscribeModal}
        phone={phone}
        onClose={() => setShowSubscribeModal(false)}
        onSuccess={fetchSubscription}
      />
      <CountyPicker
        visible={countyPickerVisible}
        selected={county}
        onSelect={setCounty}
        onClose={() => setCountyPickerVisible(false)}
      />
      <CountyPicker
        visible={editCountyPickerVisible}
        selected={editForm.county || ''}
        onSelect={(c) => setEditForm(prev => ({ ...prev, county: c }))}
        onClose={() => setEditCountyPickerVisible(false)}
      />

      {/* ── App Header ── */}
      <View style={s.appHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.appHeaderLogo}>Penzi</Text>
          {isPremium && <View style={s.premiumBadge}><Text style={s.premiumBadgeText}> Premium</Text></View>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.appHeaderName} numberOfLines={1}>{currentUser?.name}</Text>
          <TouchableOpacity style={s.coinBtn} onPress={() => setShowSubscribeModal(true)}>
            <Text style={s.coinBtnText}>💰 {subscription?.coins ?? 0}</Text>
          </TouchableOpacity>
          {!isPremium && (
            <TouchableOpacity style={s.upgradeBtn} onPress={() => setShowSubscribeModal(true)}>
              <Text style={s.upgradeBtnText}>Upgrade </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarInner}>
          {TABS.map(tab => {
            const badgeCount = tab.badgeKey ? badges[tab.badgeKey] : 0;
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, isActive && s.tabActive]}
                onPress={() => switchTab(tab.key)}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab.label}</Text>
                {badgeCount > 0 && (
                  <View style={[s.tabBadge, tab.key === 'chat' ? s.tabBadgePink : tab.key === 'interests' ? s.tabBadgeRed : s.tabBadgeGreen]}>
                    <Text style={s.tabBadgeText}>{badgeCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ══ SEARCH TAB ══ */}
      {activeTab === 'search' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabContent} keyboardShouldPersistTaps="handled">
          {/* Search limit banner */}
          {subscription && subscription.plan === 'free' && (() => {
            const remaining = subscription.searches_limit - subscription.searches_used;
            const isOut = remaining <= 0;
            const isLow = remaining === 1;
            return (
              <View style={[s.limitBanner, isOut ? s.limitBannerRed : isLow ? s.limitBannerYellow : s.limitBannerBlue]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.limitBannerTitle, isOut ? { color: '#DC2626' } : isLow ? { color: '#92400E' } : { color: '#1D4ED8' }]}>
                    {isOut ? '🚫 Daily search limit reached' : isLow ? '⚠️ Almost out of searches' : '🔍 Free Plan'}
                  </Text>
                  <Text style={s.limitBannerSub}>
                    {isOut ? 'Upgrade to Premium for unlimited searches' : `${remaining} of ${subscription.searches_limit} daily searches remaining`}
                  </Text>
                </View>
                <TouchableOpacity style={s.limitBannerBtn} onPress={() => setShowSubscribeModal(true)}>
                  <Text style={s.limitBannerBtnText}>Upgrade ✨</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          <View style={s.card}>
            <View style={s.searchingAs}>
              <Text style={s.searchingAsLabel}>Searching as</Text>
              <Text style={s.searchingAsName}>{currentUser?.name}</Text>
            </View>

            {/* Age inputs */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Min Age"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                maxLength={2}
                value={ageMin}
                onChangeText={v => setAgeMin(v.replace(/\D/g, '').slice(0, 2))}
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Max Age"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                maxLength={2}
                value={ageMax}
                onChangeText={v => setAgeMax(v.replace(/\D/g, '').slice(0, 2))}
              />
            </View>

            {/* County picker */}
            <TouchableOpacity style={s.countyPicker} onPress={() => setCountyPickerVisible(true)}>
              <Text style={county ? s.countyPickerText : s.countyPickerPlaceholder}>
                {county || 'Select County'}
              </Text>
              <Text style={{ color: COLORS.gray400, fontSize: 16 }}>▾</Text>
            </TouchableOpacity>

            {/* Search button */}
            {subscription?.plan === 'free' && subscription?.searches_used >= subscription?.searches_limit ? (
              <TouchableOpacity style={s.lockedBtn} onPress={() => setShowSubscribeModal(true)}>
                <Text style={s.lockedBtnText}>🔒 Upgrade to Search</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btn, searching && s.btnDisabled]}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Search Matches</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* Search message */}
          {searchMsg && matches.length === 0 && (
            <View style={s.card}>
              <Text style={{ color: COLORS.gray600, lineHeight: 22 }}>{searchMsg}</Text>
            </View>
          )}

          {/* Match results */}
          {matches.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Found {matches.length} match(es):</Text>
              {matches.map((match, i) => (
                <View key={i} style={[s.card, s.matchCard]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={s.matchName}>{match.name}</Text>
                      <Text style={s.matchSub}>Age: {match.age}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.outlineBtn}
                      onPress={() => setExpandedMatch(expandedMatch === i ? null : i)}
                    >
                      <Text style={s.outlineBtnText}>{expandedMatch === i ? 'Hide' : 'View details'}</Text>
                    </TouchableOpacity>
                  </View>
                  {expandedMatch === i && (
                    <View style={s.matchExpanded}>
                      <Text style={s.matchPhone}>Phone: {hashPhone(match.phone)}</Text>
                      {interestStatus[match.phone] && (
                        <View style={s.successBox}>
                          <Text style={s.successText}>{interestStatus[match.phone]}</Text>
                        </View>
                      )}
                      {interestStatus[match.phone] && (
                        <View style={s.infoBannerBlue}>
                          <Text style={s.infoBannerBlueText}>💬 Interest sent! Go to the Chat tab to start a conversation before they accept.</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[s.btn, (searching || !!interestStatus[match.phone]) && s.btnDisabled]}
                        onPress={() => handleInterest(match.phone)}
                        disabled={searching || !!interestStatus[match.phone]}
                      >
                        <Text style={s.btnText}>
                          {interestStatus[match.phone] ? 'Interest Sent ✓' : 'Send Interest'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Load more / Search again */}
          {searched && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity style={[s.outlineBtn, { flex: 1, paddingVertical: 16 }]} onPress={handleNext} disabled={searching}>
                <Text style={s.outlineBtnText}>{searching ? 'Loading...' : 'Load More'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.grayBtn, { flex: 1 }]} onPress={handleSearchAgain} disabled={searching}>
                <Text style={s.grayBtnText}>Search Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ══ CHAT TAB ══ */}
      {activeTab === 'chat' && (
        <View style={{ flex: 1 }}>
          {activeChatThread ? (
            <View style={{ flex: 1, padding: 12 }}>
              <ChatWindow
                thread={activeChatThread}
                myPhone={phone}
                onBack={() => { setActiveChatThread(null); fetchChatThreads(); }}
                onHasChatted={markHasChatted}
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.tabContent}>
              <View style={s.rowBetween}>
                <Text style={s.sectionTitle}>Messages</Text>
                <TouchableOpacity onPress={fetchChatThreads}><Text style={s.linkText}>Refresh</Text></TouchableOpacity>
              </View>
              <View style={s.infoBannerPink}>
                <Text style={s.infoBannerPinkText}>💡 Chat with someone after sending an interest. You must send at least one message before accepting or declining.</Text>
              </View>
              {chatLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : chatThreads.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>💬</Text>
                  <Text style={s.emptyTitle}>No chats yet</Text>
                  <Text style={s.emptySub}>Send an interest to someone from Find Matches to start chatting.</Text>
                  <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => setActiveTab('search')}>
                    <Text style={s.btnText}>Find Matches</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                chatThreads.map(thread => (
                  <ChatThreadItem
                    key={thread.interest_request_id}
                    thread={thread}
                    onPress={() => setActiveChatThread(thread)}
                  />
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ══ INTERESTS TAB ══ */}
      {activeTab === 'interests' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>People Interested in You</Text>
            <TouchableOpacity onPress={fetchPendingInterests}><Text style={s.linkText}>Refresh</Text></TouchableOpacity>
          </View>

          {pendingInterests.length > 0 && (
            <>
              <Text style={s.smallLabel}>AWAITING YOUR RESPONSE ({pendingInterests.length})</Text>
              <View style={s.amberBanner}>
                <Text style={s.amberBannerText}>
                  💬 <Text style={{ fontWeight: '700' }}>Chat first!</Text> Send at least one message before you can accept or decline.
                </Text>
              </View>
              {pendingInterests.map(interest => {
                const hasChatted = chattedInterests.has(interest.interest_request_id);
                return (
                  <View key={interest.interest_request_id} style={[s.card, s.interestCard]}>
                    <Text style={s.matchName}>{interest.requester_name}</Text>
                    <Text style={s.matchSub}>Age: {interest.requester_age}</Text>
                    <Text style={s.matchSub}>County: {interest.requester_county}</Text>
                    <Text style={s.matchSub}>Town: {interest.requester_town}</Text>
                    <Text style={[s.matchSub, { marginBottom: 6 }]}>Phone: {hashPhone(interest.requester_phone)}</Text>
                    <Text style={{ color: COLORS.primary, fontWeight: '600', marginBottom: 12 }}>
                      {interest.requester_name} is interested in you.
                    </Text>
                    {!hasChatted ? (
                      <TouchableOpacity
                        style={s.chatFirstBtn}
                        onPress={() => { setActiveTab('chat'); fetchChatThreads(); }}
                      >
                        <Text style={s.chatFirstBtnText}>💬 Chat first to accept or decline</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                          style={[s.btn, { flex: 1 }, responding[interest.interest_request_id] && s.btnDisabled]}
                          onPress={() => handleRespond(interest, 'YES')}
                          disabled={responding[interest.interest_request_id]}
                        >
                          <Text style={s.btnText}>{responding[interest.interest_request_id] ? 'Processing...' : 'Accept ✓'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.grayBtn, { flex: 1 }, responding[interest.interest_request_id] && s.btnDisabled]}
                          onPress={() => handleRespond(interest, 'NO')}
                          disabled={responding[interest.interest_request_id]}
                        >
                          <Text style={s.grayBtnText}>{responding[interest.interest_request_id] ? 'Processing...' : 'Decline'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {respondedInterests.length > 0 && (
            <>
              <Text style={s.smallLabel}>ALREADY RESPONDED ({respondedInterests.length})</Text>
              {respondedInterests.map((interest, i) => (
                <View key={i} style={[s.card, interest.myResponse === 'accepted' ? s.borderGreen : s.borderRed]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={s.matchName}>{interest.requester_name}</Text>
                      <Text style={s.matchSub}>Age: {interest.requester_age}</Text>
                    </View>
                    <View style={[s.responseBadge, interest.myResponse === 'accepted' ? s.responseBadgeGreen : s.responseBadgeRed]}>
                      <Text style={[s.responseBadgeText, interest.myResponse === 'accepted' ? { color: '#16A34A' } : { color: '#EF4444' }]}>
                        {interest.myResponse === 'accepted' ? 'Accepted ✓' : 'Declined'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {pendingInterests.length === 0 && respondedInterests.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No pending interest requests.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ══ MATCHES TAB ══ */}
      {activeTab === 'notifications' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>Your Matches ({acceptedInterests.length})</Text>
            <TouchableOpacity onPress={fetchAcceptedInterests}><Text style={s.linkText}>Refresh</Text></TouchableOpacity>
          </View>
          {acceptedInterests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No accepted matches yet.</Text>
              <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => setActiveTab('search')}>
                <Text style={s.btnText}>Find Matches</Text>
              </TouchableOpacity>
            </View>
          ) : (
            acceptedInterests.map((match, i) => (
              <View key={i} style={[s.card, s.borderGreen]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={s.matchName}>{match.name}, aged {match.age}</Text>
                    <Text style={{ color: '#16A34A', fontSize: 12, marginTop: 2 }}>Accepted your interest ✓</Text>
                  </View>
                  <TouchableOpacity
                    style={s.outlineBtn}
                    onPress={() => setExpandedMatch2(expandedMatch2 === i ? null : i)}
                  >
                    <Text style={s.outlineBtnText}>{expandedMatch2 === i ? 'Hide' : 'View details'}</Text>
                  </TouchableOpacity>
                </View>
                {expandedMatch2 === i && (
                  <View style={{ marginTop: 12 }}>
                    <View style={s.twoColGrid}>
                      {[
                        ['Age', `${match.age} years`],
                        ['Gender', match.gender],
                        ['County', match.county],
                        ['Town', match.town],
                        match.profession && ['Profession', match.profession],
                        match.education && ['Education', match.education],
                        match.religion && ['Religion', match.religion],
                        match.ethnicity && ['Ethnicity', match.ethnicity],
                      ].filter(Boolean).map(([label, val]) => (
                        <View key={label} style={s.gridCell}>
                          <Text style={s.gridCellLabel}>{label}</Text>
                          <Text style={s.gridCellValue}>{val}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.phoneReveal}>
                      <Text style={s.phoneRevealLabel}>Phone Number</Text>
                      <Text style={s.phoneRevealValue}>{match.phone_number}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.outlineBtnFull}
                      onPress={() => navigation.navigate('Profile', { phone: match.phone_number })}
                    >
                      <Text style={s.outlineBtnText}>View Full Profile</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ══ DASHBOARD TAB ══ */}
      {activeTab === 'dashboard' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>Your Activity</Text>
            <TouchableOpacity onPress={fetchSentInterests}><Text style={s.linkText}>Refresh</Text></TouchableOpacity>
          </View>

          {subscription && (
            <View style={[s.card, isPremium ? s.premiumCard : {}]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[s.matchName, isPremium ? { color: COLORS.white } : {}]}>
                    {isPremium ? '✨ Premium Member' : 'Free Plan'}
                  </Text>
                  <Text style={[s.matchSub, isPremium ? { color: 'rgba(255,255,255,0.8)' } : {}]}>
                    {isPremium
                      ? `Expires: ${subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}`
                      : `${subscription.searches_used}/${subscription.searches_limit} searches used today`}
                  </Text>
                </View>
                {!isPremium && (
                  <TouchableOpacity style={s.btn} onPress={() => setShowSubscribeModal(true)}>
                    <Text style={s.btnText}>Upgrade</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Stat cards */}
          <View style={s.statsGrid}>
            {[
              { filter: null,       count: totalSent,     label: 'Total Sent',    color: COLORS.primary },
              { filter: 'accepted', count: totalAccepted, label: 'Accepted',      color: '#16A34A' },
              { filter: 'declined', count: totalDeclined, label: 'Declined',      color: '#EF4444' },
              { filter: 'pending',  count: totalPending,  label: 'Awaiting Reply', color: '#D97706' },
            ].map(({ filter, count, label, color }) => (
              <TouchableOpacity
                key={String(filter)}
                style={[s.statCard, dashboardFilter === filter && s.statCardActive]}
                onPress={() => setDashboardFilter(dashboardFilter === filter && filter !== null ? null : filter)}
              >
                <Text style={[s.statCount, { color }]}>{count}</Text>
                <Text style={s.statLabel}>{label}</Text>
                {dashboardFilter === filter && filter !== null && (
                  <Text style={[s.statFilterText, { color }]}>Filtered ✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.filterHint}>
            {dashboardFilter ? 'Tap highlighted card again to clear filter' : 'Tap a card to filter the list below'}
          </Text>

          <Text style={s.sectionTitle}>Interest History</Text>
          {dashboardLoading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : filteredSent.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>{dashboardFilter ? `No ${dashboardFilter} interests yet.` : 'You have not sent any interests yet.'}</Text>
            </View>
          ) : (
            filteredSent.map((interest, i) => (
              <View key={i} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={s.matchName}>{interest.receiver_name}</Text>
                  <Text style={s.matchSub}>Age: {interest.receiver_age} · {interest.receiver_county}</Text>
                  <Text style={[s.matchSub, { fontSize: 11 }]}>Phone: {hashPhone(interest.receiver_phone)}</Text>
                </View>
                <View style={[s.responseBadge,
                  interest.status === 'accepted' ? s.responseBadgeGreen :
                  interest.status === 'declined' ? s.responseBadgeRed : s.responseBadgeYellow
                ]}>
                  <Text style={[s.responseBadgeText, {
                    color: interest.status === 'accepted' ? '#16A34A' :
                           interest.status === 'declined' ? '#EF4444' : '#D97706',
                  }]}>{interest.status}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ══ SETTINGS TAB ══ */}
      {activeTab === 'settings' && (
        <ScrollView contentContainerStyle={s.tabContent} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionTitle}>Settings</Text>

          {/* Subscription card */}
          <View style={s.card}>
            <Text style={s.cardSectionTitle}>2  Subscription & Wallet</Text>
            <View style={[s.subInfoBox, isPremium ? s.premiumCard : {}]}>
              <View>
                <Text style={[s.matchName, isPremium ? { color: COLORS.white } : {}]}>
                  {isPremium ? '✨ Premium' : 'Free Plan'}
                </Text>
                <Text style={[s.matchSub, isPremium ? { color: 'rgba(255,255,255,0.8)' } : {}]}>
                  {isPremium
                    ? `Active until ${subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : '—'}`
                    : `${subscription?.searches_used ?? 0}/${subscription?.searches_limit ?? 3} daily searches used`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.matchSub, isPremium ? { color: 'rgba(255,255,255,0.8)' } : {}]}>Coins</Text>
                <Text style={[{ fontSize: 22, fontWeight: '800' }, isPremium ? { color: COLORS.white } : { color: '#D97706' }]}>
                  💰 {subscription?.coins ?? 0}
                </Text>
              </View>
            </View>
            {!isPremium && (
              <TouchableOpacity style={s.btn} onPress={() => setShowSubscribeModal(true)}>
                <Text style={s.btnText}>Upgrade to Premium ✨ — Pay via M-Pesa</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* My Profile */}
          <View style={s.card}>
            <View style={s.rowBetween}>
              <Text style={s.cardSectionTitle}>3  My Profile</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={fetchProfile}><Text style={s.linkText}>Refresh</Text></TouchableOpacity>
                {!editingProfile && (
                  <TouchableOpacity
                    style={s.smallBtn}
                    onPress={() => {
                      setEditForm({
                        name: profileData?.name || '',
                        town: profileData?.town || '',
                        county: profileData?.county || '',
                        education: profileData?.education || '',
                        profession: profileData?.profession || '',
                        marital_status: profileData?.marital_status || '',
                        religion: profileData?.religion || '',
                        ethnicity: profileData?.ethnicity || '',
                      });
                      setEditingProfile(true);
                      setEditMessage({ text: '', type: '' });
                    }}
                  >
                    <Text style={s.smallBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {profileLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : profileData ? (
              <>
                {!editingProfile && (
                  <View style={s.twoColGrid}>
                    {[
                      ['Full Name', profileData.name],
                      ['Phone', profileData.phone_number],
                      ['Age', profileData.age ? `${profileData.age} years` : null],
                      ['Gender', profileData.gender],
                      ['County', profileData.county],
                      ['Town', profileData.town],
                      ['Profession', profileData.profession],
                      ['Education', profileData.education],
                      ['Marital Status', profileData.marital_status],
                      ['Religion', profileData.religion],
                      ['Ethnicity', profileData.ethnicity],
                    ].map(([label, val]) => (
                      <ProfileField key={label} label={label} value={val} />
                    ))}
                  </View>
                )}
                {editingProfile && (
                  <View>
                    {[
                      { key: 'name', label: 'Full Name' },
                      { key: 'town', label: 'Town' },
                      { key: 'profession', label: 'Profession' },
                      { key: 'education', label: 'Education Level' },
                      { key: 'marital_status', label: 'Marital Status' },
                      { key: 'religion', label: 'Religion' },
                      { key: 'ethnicity', label: 'Ethnicity' },
                    ].map(({ key, label }) => (
                      <View key={key} style={{ marginBottom: 12 }}>
                        <Text style={s.inputLabel}>{label}</Text>
                        <TextInput
                          style={s.input}
                          value={editForm[key]}
                          onChangeText={v => setEditForm(prev => ({ ...prev, [key]: v }))}
                          placeholder={label}
                          placeholderTextColor={COLORS.gray400}
                        />
                      </View>
                    ))}
                    <Text style={s.inputLabel}>County</Text>
                    <TouchableOpacity style={s.countyPicker} onPress={() => setEditCountyPickerVisible(true)}>
                      <Text style={editForm.county ? s.countyPickerText : s.countyPickerPlaceholder}>
                        {editForm.county || 'Select County'}
                      </Text>
                      <Text style={{ color: COLORS.gray400, fontSize: 16 }}>▾</Text>
                    </TouchableOpacity>

                    {editMessage.text ? (
                      <View style={[s.msgBox, editMessage.type === 'success' ? s.msgBoxSuccess : s.msgBoxError]}>
                        <Text style={editMessage.type === 'success' ? s.msgSuccess : s.msgError}>{editMessage.text}</Text>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                      <TouchableOpacity style={[s.btn, { flex: 1 }, savingProfile && s.btnDisabled]} onPress={handleProfileUpdate} disabled={savingProfile}>
                        <Text style={s.btnText}>{savingProfile ? 'Saving...' : 'Save Changes'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.grayBtn, { flex: 1 }]} onPress={() => { setEditingProfile(false); setEditMessage({ text: '', type: '' }); }}>
                        <Text style={s.grayBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: COLORS.gray400 }}>Could not load profile.</Text>
                <TouchableOpacity onPress={fetchProfile}><Text style={s.linkText}>Try again</Text></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Change Password */}
          <View style={s.card}>
            <Text style={s.cardSectionTitle}>4  Change Password</Text>
            {[
              { label: 'Current Password', value: currentPw, setter: setCurrentPw, show: showCurrentPw, toggle: () => setShowCurrentPw(p => !p) },
              { label: 'New Password',     value: newPw,     setter: setNewPw,     show: showNewPw,     toggle: () => setShowNewPw(p => !p) },
              { label: 'Confirm New Password', value: confirmPw, setter: setConfirmPw, show: showConfirmPw, toggle: () => setShowConfirmPw(p => !p) },
            ].map(({ label, value, setter, show, toggle }) => (
              <View key={label} style={{ marginBottom: 12 }}>
                <Text style={s.inputLabel}>{label}</Text>
                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    placeholder={label}
                    placeholderTextColor={COLORS.gray400}
                    secureTextEntry={!show}
                    value={value}
                    onChangeText={setter}
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={toggle}>
                    <Text style={s.eyeIcon}>{show ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {pwMessage.text ? (
              <View style={[s.msgBox, pwMessage.type === 'success' ? s.msgBoxSuccess : s.msgBoxError]}>
                <Text style={pwMessage.type === 'success' ? s.msgSuccess : s.msgError}>{pwMessage.text}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={[s.btn, pwLoading && s.btnDisabled]} onPress={handlePasswordChange} disabled={pwLoading}>
              <Text style={s.btnText}>{pwLoading ? 'Updating...' : 'Update Password'}</Text>
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <View style={[s.card, { borderWidth: 1, borderColor: '#FCA5A5' }]}>
            <Text style={[s.cardSectionTitle, { color: '#EF4444' }]}>Account</Text>
            <TouchableOpacity style={s.signOutBtn} onPress={handleLogout}>
              <Text style={s.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}


// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Layout
  tabContent:    { padding: 16, paddingBottom: 40 },
  card:          { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 14, ...SHADOWS.card },
  rowBetween:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  // App header
  appHeader:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appHeaderLogo:  { color: COLORS.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  appHeaderName:  { color: 'rgba(255,255,255,0.85)', fontSize: 13, maxWidth: 80 },
  premiumBadge:   { backgroundColor: '#FDE68A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  premiumBadgeText: { color: '#78350F', fontSize: 11, fontWeight: '800' },
  coinBtn:        { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  coinBtnText:    { color: '#92400E', fontWeight: '700', fontSize: 13 },
  upgradeBtn:     { backgroundColor: '#FDE68A', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  upgradeBtnText: { color: '#78350F', fontWeight: '800', fontSize: 12 },
  logoutBtn:      { backgroundColor: COLORS.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  logoutBtnText:  { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  // Tab bar
  tabBar:         { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  tabBarInner:    { paddingHorizontal: 4 },
  tab:            { paddingHorizontal: 14, paddingVertical: 14, position: 'relative' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText:        { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  tabTextActive:  { color: COLORS.primary },
  tabBadge:       { position: 'absolute', top: 8, right: 4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgePink:   { backgroundColor: COLORS.primary },
  tabBadgeRed:    { backgroundColor: '#EF4444' },
  tabBadgeGreen:  { backgroundColor: '#16A34A' },
  tabBadgeText:   { color: COLORS.white, fontSize: 10, fontWeight: '800' },

  // Buttons — all have good padding for easy tapping
  btn:            { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, ...SHADOWS.card },
  btnDisabled:    { opacity: 0.6 },
  btnText:        { color: COLORS.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  grayBtn:        { backgroundColor: COLORS.gray200, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  grayBtnText:    { color: COLORS.gray700, fontWeight: '700', fontSize: 15 },
  outlineBtn:     { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  outlineBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  outlineBtnFull: { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  lockedBtn:      { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.gray300, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  lockedBtnText:  { color: COLORS.gray500, fontWeight: '700', fontSize: 15 },
  smallBtn:       { backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  smallBtnText:   { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  chatFirstBtn:   { borderWidth: 2, borderColor: '#93C5FD', backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  chatFirstBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 14 },
  signOutBtn:     { borderWidth: 2, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  signOutBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },

  // Forms
  input:          { borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.gray800, backgroundColor: COLORS.gray50 },
  inputLabel:     { fontSize: 12, fontWeight: '600', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  countyPicker:   { borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.gray50, marginBottom: 12 },
  countyPickerText:        { fontSize: 15, color: COLORS.gray800 },
  countyPickerPlaceholder: { fontSize: 15, color: COLORS.gray400 },
  passwordRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:         { padding: 10 },
  eyeIcon:        { fontSize: 18 },

  // Search
  searchingAs:    { backgroundColor: '#FDF2F8', borderRadius: 10, padding: 12, marginBottom: 14 },
  searchingAsLabel: { fontSize: 12, color: COLORS.gray500 },
  searchingAsName:  { fontWeight: '700', color: COLORS.primary, fontSize: 15 },

  // Banners
  limitBanner:       { borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  limitBannerRed:    { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  limitBannerYellow: { backgroundColor: '#FEFCE8', borderColor: '#FDE68A' },
  limitBannerBlue:   { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  limitBannerTitle:  { fontWeight: '700', fontSize: 13 },
  limitBannerSub:    { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  limitBannerBtn:    { backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 10 },
  limitBannerBtnText:{ color: COLORS.white, fontWeight: '800', fontSize: 12 },
  infoBannerPink:    { backgroundColor: '#FDF2F8', borderWidth: 1, borderColor: '#FBCFE8', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoBannerPinkText:{ color: COLORS.primary, fontSize: 12 },
  infoBannerBlue:    { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, padding: 10, marginBottom: 10 },
  infoBannerBlueText:{ color: '#1D4ED8', fontSize: 12 },
  amberBanner:       { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginBottom: 14 },
  amberBannerText:   { color: '#92400E', fontSize: 12 },

  // Match cards
  matchCard:      { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  matchName:      { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 2 },
  matchSub:       { fontSize: 13, color: COLORS.gray500, marginBottom: 2 },
  matchPhone:     { fontSize: 13, color: COLORS.gray400, marginBottom: 8 },
  matchExpanded:  { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 12 },
  successBox:     { backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 8 },
  successText:    { color: '#16A34A', fontSize: 13 },

  // Grid
  twoColGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  gridCell:       { backgroundColor: COLORS.gray50, borderRadius: 10, padding: 12, width: '47.5%' },
  gridCellLabel:  { fontSize: 11, color: COLORS.gray400, marginBottom: 2 },
  gridCellValue:  { fontWeight: '600', color: COLORS.gray700, fontSize: 13 },
  phoneReveal:    { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 14, marginBottom: 10 },
  phoneRevealLabel: { fontSize: 11, color: '#16A34A', fontWeight: '700', marginBottom: 4 },
  phoneRevealValue: { fontSize: 18, fontWeight: '800', color: '#14532D' },

  // Interest / dashboard
  interestCard:   { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  borderGreen:    { borderLeftWidth: 4, borderLeftColor: '#4ADE80' },
  borderRed:      { borderLeftWidth: 4, borderLeftColor: '#FCA5A5' },
  responseBadge:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  responseBadgeGreen:  { backgroundColor: '#F0FDF4' },
  responseBadgeRed:    { backgroundColor: '#FEF2F2' },
  responseBadgeYellow: { backgroundColor: '#FEFCE8' },
  responseBadgeText:   { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  // Dashboard
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  statCard:       { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, width: '47%', alignItems: 'center', ...SHADOWS.card },
  statCardActive: { borderWidth: 2, borderColor: COLORS.primary },
  statCount:      { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  statLabel:      { fontSize: 13, color: COLORS.gray500 },
  statFilterText: { fontSize: 11, marginTop: 4 },
  filterHint:     { fontSize: 11, color: COLORS.gray400, textAlign: 'center', marginBottom: 14 },
  premiumCard:    { background: COLORS.primary, backgroundColor: COLORS.primary },

  // Settings
  cardSectionTitle: { fontWeight: '800', color: COLORS.gray700, fontSize: 15, marginBottom: 14 },
  subInfoBox:       { borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.gray50, marginBottom: 14 },
  profileField:     { backgroundColor: COLORS.gray50, borderRadius: 10, padding: 12, width: '47.5%' },
  profileFieldLabel: { fontSize: 11, color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  profileFieldValue: { fontWeight: '600', color: COLORS.gray800, fontSize: 13 },
  msgBox:           { borderRadius: 10, padding: 12, marginBottom: 10 },
  msgBoxSuccess:    { backgroundColor: '#F0FDF4' },
  msgBoxError:      { backgroundColor: '#FEF2F2' },
  msgSuccess:       { color: '#16A34A', fontSize: 13, textAlign: 'center' },
  msgError:         { color: '#EF4444', fontSize: 13, textAlign: 'center' },

  // Misc
  sectionTitle:   { fontSize: 17, fontWeight: '800', color: COLORS.gray700 },
  sectionLabel:   { fontSize: 14, fontWeight: '700', color: COLORS.gray600, marginBottom: 8 },
  smallLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  linkText:       { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  emptyCard:      { backgroundColor: COLORS.white, borderRadius: 16, padding: 32, alignItems: 'center', ...SHADOWS.card },
  emptyTitle:     { fontSize: 16, fontWeight: '600', color: COLORS.gray500, textAlign: 'center' },
  emptySub:       { fontSize: 13, color: COLORS.gray400, textAlign: 'center', marginTop: 6 },
  gray600:        { color: COLORS.gray600 ?? '#4B5563' },
});
