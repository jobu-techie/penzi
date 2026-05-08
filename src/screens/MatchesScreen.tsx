import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, ActivityIndicator, RefreshControl,
  StatusBar, Modal, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { COLORS, SHADOWS, KENYA_COUNTIES, hashPhone } from '../theme';

const TABS = [
  { key: 'search', label: 'Find' },
  { key: 'interests', label: 'Interests' },
  { key: 'matches', label: 'Matches' },
  { key: 'dashboard', label: 'Dashboard' },
];

export default function MatchesScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [phone, setPhone] = useState('');
  const [activeTab, setActiveTab] = useState('search');

  // Search state
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [county, setCounty] = useState('');
  const [countyModal, setCountyModal] = useState(false);
  const [matches, setMatches] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [interestStatus, setInterestStatus] = useState({});

  // Interests/matches state
  const [pendingInterests, setPendingInterests] = useState([]);
  const [acceptedInterests, setAcceptedInterests] = useState([]);
  const [responding, setResponding] = useState({});

  // Dashboard state
  const [sentInterests, setSentInterests] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await AsyncStorage.getItem('penzi_user');
      if (!u) { navigation.replace('Login'); return; }
      const user = JSON.parse(u);
      setCurrentUser(user);
      setPhone(user.phone_number);
    })();
  }, []);

  const fetchPending = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await api.get(`/interest/pending/${phone}`);
      setPendingInterests(res.data);
    } catch {}
  }, [phone]);

  const fetchAccepted = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await api.get(`/interest/accepted/${phone}`);
      setAcceptedInterests(res.data);
    } catch {}
  }, [phone]);

  const fetchSent = useCallback(async () => {
    if (!phone) return;
    setDashboardLoading(true);
    try {
      const res = await api.get(`/interest/sent/${phone}`);
      setSentInterests(res.data);
    } catch {}
    finally { setDashboardLoading(false); }
  }, [phone]);

  useEffect(() => {
    if (!phone) return;
    fetchPending();
    fetchAccepted();
    const interval = setInterval(() => { fetchPending(); fetchAccepted(); }, 10000);
    return () => clearInterval(interval);
  }, [phone, fetchPending, fetchAccepted]);

  const sendSms = async (msg) =>
    api.post('/webhook/onfon', { sender: phone, message: msg }, {
      headers: { 'X-Webhook-Token': 'jobu' },
    });

  const parseMatches = (text) => {
    const lines = (text || '').split('\n').filter(l => l.includes('aged') && l.includes(','));
    return lines.map(line => {
      const parts = line.split(',');
      const nameParts = parts[0].split(' aged ');
      return { name: nameParts[0]?.trim(), age: nameParts[1]?.trim(), phone: parts[1]?.trim() };
    });
  };

  const handleSearch = async () => {
    if (!ageMin || !ageMax || !county) { setMessage('Please fill in all fields.'); return; }
    setLoading(true); setMessage(''); setMatches([]);
    try {
      const res = await sendSms(`match#${ageMin}-${ageMax}#${county}`);
      setMessage(res.data);
      setMatches(parseMatches(res.data));
      setSearched(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setMessage('You already have a match request. Click Search Again to reset.');
        setSearched(true);
      } else setMessage('Failed to search. Please try again.');
    } finally { setLoading(false); }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      const res = await sendSms('NEXT');
      setMessage(res.data);
      setMatches(prev => [...prev, ...parseMatches(res.data)]);
    } catch { setMessage('No more matches available.'); }
    finally { setLoading(false); }
  };

  const handleSearchAgain = async () => {
    setLoading(true);
    try {
      const userRes = await api.get(`/users/phone/${phone}`);
      await api.delete(`/match/reset/${userRes.data.id}`);
      setMessage(''); setSearched(false); setMatches([]);
      setAgeMin(''); setAgeMax(''); setCounty(''); setInterestStatus({});
    } catch { setMessage('Failed to reset. Try again.'); }
    finally { setLoading(false); }
  };

  const handleInterest = async (matchPhone) => {
    setLoading(true);
    try {
      const res = await sendSms(matchPhone);
      setInterestStatus(p => ({ ...p, [matchPhone]: res.data }));
    } catch (err) {
      setInterestStatus(p => ({
        ...p,
        [matchPhone]: err.response?.status === 409 ? 'Interest already sent.' : 'Failed to send.',
      }));
    } finally { setLoading(false); }
  };

  const handleRespond = async (id, response) => {
    setResponding(p => ({ ...p, [id]: true }));
    try {
      await sendSms(response);
      setPendingInterests(p => p.filter(i => i.interest_request_id !== id));
      fetchAccepted();
    } catch {}
    finally { setResponding(p => ({ ...p, [id]: false })); }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['penzi_token', 'penzi_user']);
    navigation.replace('Login');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPending(), fetchAccepted()]);
    setRefreshing(false);
  };

  const totalSent = sentInterests.length;
  const totalAccepted = sentInterests.filter(i => i.status === 'accepted').length;
  const totalDeclined = sentInterests.filter(i => i.status === 'declined').length;
  const totalPending = sentInterests.filter(i => i.status === 'pending').length;

  const statusColor = (status) => {
    if (status === 'accepted') return { color: COLORS.green600, bg: COLORS.green50 };
    if (status === 'declined') return { color: COLORS.red500, bg: COLORS.red50 };
    return { color: '#b45309', bg: '#fffbeb' };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* County Modal */}
      <Modal visible={countyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select County</Text>
            <FlatList
              data={KENYA_COUNTIES}
              keyExtractor={i => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setCounty(item); setCountyModal(false); }}
                >
                  <Text style={[styles.modalItemText, county === item && styles.modalItemSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCountyModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>Penzi</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerUser} numberOfLines={1}>{currentUser?.name}</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => {
              setActiveTab(tab.key);
              if (tab.key === 'interests') fetchPending();
              if (tab.key === 'matches') fetchAccepted();
              if (tab.key === 'dashboard') fetchSent();
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.key === 'interests' && pendingInterests.length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{pendingInterests.length}</Text></View>
            )}
            {tab.key === 'matches' && acceptedInterests.length > 0 && (
              <View style={[styles.badge, { backgroundColor: COLORS.green500 }]}>
                <Text style={styles.badgeText}>{acceptedInterests.length}</Text>
              </View>
            )}
            {activeTab === tab.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── FIND MATCHES TAB ── */}
        {activeTab === 'search' && (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <View style={styles.searchingAs}>
                <Text style={styles.searchingAsLabel}>Searching as</Text>
                <Text style={styles.searchingAsName}>{currentUser?.name}</Text>
              </View>

              <View style={styles.ageRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Min Age"
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={ageMin}
                  onChangeText={v => setAgeMin(v.replace(/\D/g, '').slice(0, 2))}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Max Age"
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={ageMax}
                  onChangeText={v => setAgeMax(v.replace(/\D/g, '').slice(0, 2))}
                />
              </View>

              <TouchableOpacity style={styles.selectBtn} onPress={() => setCountyModal(true)}>
                <Text style={[styles.selectBtnText, !county && { color: COLORS.gray400 }]}>
                  {county || 'Select County'}
                </Text>
                <Text style={styles.selectArrow}>▾</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleSearch}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.primaryBtnText}>Search Matches</Text>
                }
              </TouchableOpacity>
            </View>

            {message && matches.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            )}

            {matches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Found {matches.length} match(es)</Text>
                {matches.map((match, i) => (
                  <View key={i} style={[styles.card, styles.matchCard]}>
                    <View style={styles.matchAvatar}>
                      <Text style={styles.matchAvatarText}>{match.name?.charAt(0)}</Text>
                    </View>
                    <View style={styles.matchInfo}>
                      <Text style={styles.matchName}>{match.name}</Text>
                      <Text style={styles.matchMeta}>Age: {match.age}</Text>
                      <Text style={styles.matchPhone}>📞 {hashPhone(match.phone)}</Text>
                    </View>
                    {interestStatus[match.phone] ? (
                      <View style={styles.interestSentBadge}>
                        <Text style={styles.interestSentText}>Sent ✓</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.interestBtn}
                        onPress={() => handleInterest(match.phone)}
                        disabled={loading}
                      >
                        <Text style={styles.interestBtnText}>💕 Interest</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}

            {searched && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.outlineBtn, { flex: 1 }]}
                  onPress={handleNext}
                  disabled={loading}
                >
                  <Text style={styles.outlineBtnText}>Load More</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.grayBtn, { flex: 1 }]}
                  onPress={handleSearchAgain}
                  disabled={loading}
                >
                  <Text style={styles.grayBtnText}>Search Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── INTERESTS TAB ── */}
        {activeTab === 'interests' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                People Interested in You ({pendingInterests.length})
              </Text>
              <TouchableOpacity onPress={fetchPending}>
                <Text style={styles.refreshLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {pendingInterests.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyIcon}>💌</Text>
                <Text style={styles.emptyText}>No pending interest requests.</Text>
              </View>
            ) : (
              pendingInterests.map(interest => (
                <View key={interest.interest_request_id} style={[styles.card, styles.interestCard]}>
                  <View style={styles.interestAvatar}>
                    <Text style={styles.interestAvatarText}>{interest.requester_name?.charAt(0)}</Text>
                  </View>
                  <Text style={styles.interestName}>{interest.requester_name}</Text>
                  <Text style={styles.interestMeta}>Age: {interest.requester_age} · {interest.requester_county}</Text>
                  <Text style={styles.interestMeta}>Town: {interest.requester_town}</Text>
                  <Text style={styles.interestPhone}>📞 {hashPhone(interest.requester_phone)}</Text>
                  <Text style={styles.interestPrompt}>
                    {interest.requester_name} is interested in you. Do you accept?
                  </Text>
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { flex: 1 }]}
                      onPress={() => handleRespond(interest.interest_request_id, 'YES')}
                      disabled={responding[interest.interest_request_id]}
                    >
                      {responding[interest.interest_request_id]
                        ? <ActivityIndicator color={COLORS.white} size="small" />
                        : <Text style={styles.primaryBtnText}>Accept</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.grayBtn, { flex: 1 }]}
                      onPress={() => handleRespond(interest.interest_request_id, 'NO')}
                      disabled={responding[interest.interest_request_id]}
                    >
                      <Text style={styles.grayBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── MATCHES TAB ── */}
        {activeTab === 'matches' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Matches ({acceptedInterests.length})</Text>
              <TouchableOpacity onPress={fetchAccepted}>
                <Text style={styles.refreshLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {acceptedInterests.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyIcon}>💔</Text>
                <Text style={styles.emptyText}>No accepted matches yet.</Text>
                <Text style={styles.emptySubText}>Send interests to potential matches!</Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 16 }]}
                  onPress={() => setActiveTab('search')}
                >
                  <Text style={styles.primaryBtnText}>Find Matches</Text>
                </TouchableOpacity>
              </View>
            ) : (
              acceptedInterests.map((match, i) => (
                <View key={i} style={styles.card}>
                  <View style={styles.matchHeader}>
                    <View style={styles.matchHeaderAvatar}>
                      <Text style={styles.matchHeaderAvatarText}>{match.name?.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.matchHeaderName}>{match.name}</Text>
                      <Text style={styles.matchHeaderSub}>Accepted your interest ✓</Text>
                    </View>
                  </View>
                  <View style={styles.detailsGrid}>
                    {[
                      { label: 'Age', val: `${match.age} years` },
                      { label: 'Gender', val: match.gender },
                      { label: 'County', val: match.county },
                      { label: 'Town', val: match.town },
                      match.profession && { label: 'Profession', val: match.profession },
                      match.education && { label: 'Education', val: match.education },
                      match.religion && { label: 'Religion', val: match.religion },
                      match.ethnicity && { label: 'Ethnicity', val: match.ethnicity },
                    ].filter(Boolean).map(({ label, val }) => (
                      <View key={label} style={styles.detailItem}>
                        <Text style={styles.detailLabel}>{label}</Text>
                        <Text style={styles.detailVal}>{val}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.phoneRevealBox}>
                    <Text style={styles.phoneRevealLabel}>📞 Phone Number</Text>
                    <Text style={styles.phoneRevealNumber}>{match.phone_number}</Text>
                    <Text style={styles.phoneRevealHint}>Feel free to reach out!</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => navigation.navigate('Profile', { phone: match.phone_number })}
                  >
                    <Text style={styles.outlineBtnText}>View Full Profile</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Activity</Text>
              <TouchableOpacity onPress={fetchSent}>
                <Text style={styles.refreshLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              {[
                { num: totalSent, label: 'Total Sent', color: COLORS.primary },
                { num: totalAccepted, label: 'Accepted', color: COLORS.green500 },
                { num: totalDeclined, label: 'Declined', color: COLORS.red400 },
                { num: totalPending, label: 'Awaiting', color: COLORS.yellow500 },
              ].map(({ num, label, color }) => (
                <View key={label} style={styles.statCard}>
                  <Text style={[styles.statNum, { color }]}>{num}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Interest History</Text>

            {dashboardLoading ? (
              <View style={[styles.card, styles.emptyCard]}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : sentInterests.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyIcon}>📤</Text>
                <Text style={styles.emptyText}>No interests sent yet.</Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 16 }]}
                  onPress={() => setActiveTab('search')}
                >
                  <Text style={styles.primaryBtnText}>Find Matches</Text>
                </TouchableOpacity>
              </View>
            ) : (
              sentInterests.map((interest, i) => {
                const sc = statusColor(interest.status);
                return (
                  <View key={i} style={[styles.card, styles.historyCard]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyName}>{interest.receiver_name}</Text>
                      <Text style={styles.historyMeta}>Age: {interest.receiver_age} · {interest.receiver_county}</Text>
                      <Text style={styles.historyPhone}>📞 {hashPhone(interest.receiver_phone)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.color }]}>
                        {interest.status}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...SHADOWS.header,
  },
  headerLogo: { fontSize: 26, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerUser: { color: 'rgba(255,255,255,0.85)', fontSize: 13, maxWidth: 100 },
  logoutBtn: {
    backgroundColor: COLORS.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  logoutText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  tabBar: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    ...SHADOWS.header,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    position: 'relative',
  },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.gray400 },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 3, backgroundColor: COLORS.primary, borderRadius: 2,
  },
  badge: {
    position: 'absolute', top: 6, right: 4,
    backgroundColor: COLORS.red500,
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  body: { flex: 1, backgroundColor: COLORS.gray100 },
  tabContent: { padding: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    ...SHADOWS.card,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.gray800 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray500, marginBottom: 10 },
  refreshLink: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  searchingAs: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10, padding: 10, marginBottom: 14,
  },
  searchingAsLabel: { fontSize: 11, color: COLORS.gray500 },
  searchingAsName: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  ageRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.gray200,
    borderRadius: 12, padding: 13, fontSize: 15,
    color: COLORS.gray800, backgroundColor: COLORS.gray50, marginBottom: 10,
  },
  selectBtn: {
    borderWidth: 1.5, borderColor: COLORS.gray200,
    borderRadius: 12, padding: 13,
    backgroundColor: COLORS.gray50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  selectBtnText: { fontSize: 15, color: COLORS.gray700 },
  selectArrow: { color: COLORS.gray400, fontSize: 16 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', ...SHADOWS.card,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  outlineBtn: {
    borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  grayBtn: {
    backgroundColor: COLORS.gray200,
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  grayBtnText: { color: COLORS.gray700, fontWeight: '700', fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  messageText: { color: COLORS.gray500, fontSize: 14, lineHeight: 20 },
  // Match cards
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  matchAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  matchAvatarText: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  matchInfo: { flex: 1 },
  matchName: { fontSize: 16, fontWeight: '800', color: COLORS.gray800 },
  matchMeta: { fontSize: 13, color: COLORS.gray500 },
  matchPhone: { fontSize: 12, color: COLORS.gray400 },
  interestBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  interestBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  interestSentBadge: {
    backgroundColor: COLORS.green50, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  interestSentText: { color: COLORS.green600, fontWeight: '700', fontSize: 13 },
  // Interest card
  interestCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  interestAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 10,
  },
  interestAvatarText: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  interestName: { fontSize: 18, fontWeight: '800', color: COLORS.gray800, textAlign: 'center', marginBottom: 4 },
  interestMeta: { fontSize: 13, color: COLORS.gray500, textAlign: 'center' },
  interestPhone: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', marginBottom: 8 },
  interestPrompt: {
    color: COLORS.primary, fontWeight: '700', fontSize: 14,
    textAlign: 'center', marginBottom: 14,
  },
  // Match detail card
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  matchHeaderAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  matchHeaderAvatarText: { fontSize: 22, fontWeight: '900', color: COLORS.white },
  matchHeaderName: { fontSize: 18, fontWeight: '800', color: COLORS.gray800 },
  matchHeaderSub: { fontSize: 12, color: COLORS.green600, fontWeight: '600' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  detailItem: {
    width: '47%', backgroundColor: COLORS.gray50,
    borderRadius: 10, padding: 10,
  },
  detailLabel: { fontSize: 10, color: COLORS.gray400, marginBottom: 2 },
  detailVal: { fontSize: 14, fontWeight: '700', color: COLORS.gray700 },
  phoneRevealBox: {
    backgroundColor: COLORS.green50,
    borderWidth: 1, borderColor: COLORS.green200,
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  phoneRevealLabel: { fontSize: 11, color: COLORS.green600, fontWeight: '700', marginBottom: 4 },
  phoneRevealNumber: { fontSize: 22, fontWeight: '900', color: COLORS.green700 },
  phoneRevealHint: { fontSize: 11, color: COLORS.green600, marginTop: 2 },
  // Dashboard
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: COLORS.white,
    borderRadius: 16, padding: 18, alignItems: 'center',
    ...SHADOWS.card,
  },
  statNum: { fontSize: 32, fontWeight: '900' },
  statLabel: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  historyCard: { flexDirection: 'row', alignItems: 'center' },
  historyName: { fontSize: 15, fontWeight: '800', color: COLORS.gray800 },
  historyMeta: { fontSize: 12, color: COLORS.gray500 },
  historyPhone: { fontSize: 11, color: COLORS.gray400 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  // Empty states
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, color: COLORS.gray400, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: COLORS.gray400, marginTop: 4, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '75%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.gray800, marginBottom: 12 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  modalItemText: { fontSize: 15, color: COLORS.gray700 },
  modalItemSelected: { color: COLORS.primary, fontWeight: '700' },
  modalClose: { marginTop: 12, padding: 14, backgroundColor: COLORS.gray100, borderRadius: 12, alignItems: 'center' },
  modalCloseText: { color: COLORS.gray700, fontWeight: '700', fontSize: 15 },
});
